// routes/timelogs.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// GET all time logs for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('pid', sql.Int, req.params.projectId)
            .query(`SELECT tl.*, u.Name AS FreelancerName 
                    FROM TimeLogs tl
                    JOIN Users u ON tl.FreelancerID = u.UserID
                    WHERE tl.ProjectID = @pid
                    ORDER BY tl.StartTime DESC`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET total hours + invoice summary for a project (for invoicing/reporting)
router.get('/project/:projectId/summary', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('pid', sql.Int, req.params.projectId)
            .query(`SELECT 
                        COUNT(*) AS TotalSessions, 
                        SUM(HoursLogged) AS TotalHours
                    FROM TimeLogs WHERE ProjectID = @pid`);
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Calls the Azure Function to calculate hours between two timestamps.
 * Falls back to local calculation if the function is unavailable.
 */
async function calculateHours(startTime, endTime) {
    var functionUrl = process.env.AZURE_FUNCTION_CALC_HOURS_URL;

    if (functionUrl) {
        try {
            // Dynamic import of https module for the Azure Function call
            var https = require('https');
            var http = require('http');

            var body = JSON.stringify({ startTime: startTime, endTime: endTime });
            var parsedUrl = new URL(functionUrl);
            var transport = parsedUrl.protocol === 'https:' ? https : http;

            var result = await new Promise(function(resolve, reject) {
                var options = {
                    method: 'POST',
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                };

                var req = transport.request(options, function(res) {
                    var data = '';
                    res.on('data', function(chunk) { data += chunk; });
                    res.on('end', function() {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(new Error('Azure Function returned invalid JSON: ' + data));
                            }
                        } else {
                            reject(new Error('Azure Function returned status ' + res.statusCode + ': ' + data));
                        }
                    });
                });

                req.on('error', function(err) { reject(err); });
                req.write(body);
                req.end();
            });

            // The function should return the calculated hours in some field
            var hours = result.hours || result.Hours || result.hoursLogged || result.HoursLogged || result.totalHours;
            if (hours !== undefined && hours !== null) {
                console.log('✅ Azure Function calculated hours:', hours);
                return parseFloat(hours).toFixed(2);
            }

            console.warn('⚠️  Azure Function response missing hours field, falling back to local calc. Response:', JSON.stringify(result));
        } catch (err) {
            console.warn('⚠️  Azure Function call failed, falling back to local calculation:', err.message);
        }
    } else {
        console.warn('⚠️  AZURE_FUNCTION_CALC_HOURS_URL not set, using local calculation');
    }

    // Fallback: calculate locally
    var start = new Date(startTime);
    var end = new Date(endTime);
    return ((end - start) / (1000 * 60 * 60)).toFixed(2);
}

// CREATE a time log entry — calculates hours via Azure Function
router.post('/', async (req, res) => {
    var ProjectID = req.body.ProjectID;
    var FreelancerID = req.body.FreelancerID;
    var StartTime = req.body.StartTime;
    var EndTime = req.body.EndTime;

    if (!ProjectID || !FreelancerID || !StartTime || !EndTime) {
        return res.status(400).json({ error: 'ProjectID, FreelancerID, StartTime, and EndTime are required' });
    }

    var start = new Date(StartTime);
    var end = new Date(EndTime);
    if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ error: 'Invalid start/end time — end must be after start' });
    }

    try {
        // Call Azure Function to calculate hours (falls back to local if unavailable)
        var hours = await calculateHours(StartTime, EndTime);

        var pool = await getPool();
        var result = await pool.request()
            .input('ProjectID', sql.Int, ProjectID)
            .input('FreelancerID', sql.Int, FreelancerID)
            .input('StartTime', sql.DateTime, start)
            .input('EndTime', sql.DateTime, end)
            .input('HoursLogged', sql.Decimal(5, 2), hours)
            .query('INSERT INTO TimeLogs (ProjectID, FreelancerID, StartTime, EndTime, HoursLogged) OUTPUT INSERTED.* VALUES (@ProjectID, @FreelancerID, @StartTime, @EndTime, @HoursLogged)');
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
