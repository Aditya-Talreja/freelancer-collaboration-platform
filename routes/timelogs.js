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

// CREATE a time log entry — auto-calculates hours from start/end
router.post('/', async (req, res) => {
    const { ProjectID, FreelancerID, StartTime, EndTime } = req.body;
    if (!ProjectID || !FreelancerID || !StartTime || !EndTime) {
        return res.status(400).json({ error: 'ProjectID, FreelancerID, StartTime, and EndTime are required' });
    }

    const start = new Date(StartTime);
    const end = new Date(EndTime);
    if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ error: 'Invalid start/end time — end must be after start' });
    }
    const hours = ((end - start) / (1000 * 60 * 60)).toFixed(2);

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('ProjectID', sql.Int, ProjectID)
            .input('FreelancerID', sql.Int, FreelancerID)
            .input('StartTime', sql.DateTime, start)
            .input('EndTime', sql.DateTime, end)
            .input('HoursLogged', sql.Decimal(5, 2), hours)
            .query(`INSERT INTO TimeLogs (ProjectID, FreelancerID, StartTime, EndTime, HoursLogged)
                    OUTPUT INSERTED.*
                    VALUES (@ProjectID, @FreelancerID, @StartTime, @EndTime, @HoursLogged)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
