// routes/projects.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// GET all projects (with client + freelancer names joined in)
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT p.*, 
                   c.Name AS ClientName, 
                   f.Name AS FreelancerName
            FROM Projects p
            LEFT JOIN Users c ON p.ClientID = c.UserID
            LEFT JOIN Users f ON p.FreelancerID = f.UserID
            ORDER BY p.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single project
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Projects WHERE ProjectID = @id');
        if (result.recordset.length === 0) return res.status(404).json({ error: 'Project not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE project
router.post('/', async (req, res) => {
    const { ClientID, FreelancerID, Title, Description, Status } = req.body;
    if (!Title || !ClientID) {
        return res.status(400).json({ error: 'Title and ClientID are required' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('ClientID', sql.Int, ClientID)
            .input('FreelancerID', sql.Int, FreelancerID || null)
            .input('Title', sql.NVarChar, Title)
            .input('Description', sql.NVarChar, Description || '')
            .input('Status', sql.NVarChar, Status || 'Open')
            .query(`INSERT INTO Projects (ClientID, FreelancerID, Title, Description, Status)
                    OUTPUT INSERTED.*
                    VALUES (@ClientID, @FreelancerID, @Title, @Description, @Status)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE project status
router.put('/:id', async (req, res) => {
    const { Status, FreelancerID } = req.body;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('Status', sql.NVarChar, Status)
            .input('FreelancerID', sql.Int, FreelancerID || null)
            .query(`UPDATE Projects SET Status = @Status, FreelancerID = COALESCE(@FreelancerID, FreelancerID)
                    OUTPUT INSERTED.*
                    WHERE ProjectID = @id`);
        if (result.recordset.length === 0) return res.status(404).json({ error: 'Project not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE project
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Projects WHERE ProjectID = @id');
        res.json({ message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
