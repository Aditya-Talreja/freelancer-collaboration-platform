// routes/reviews.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// GET all reviews for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('pid', sql.Int, req.params.projectId)
            .query('SELECT * FROM Reviews WHERE ProjectID = @pid ORDER BY ReviewDate DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET average rating for a freelancer (across all their projects)
router.get('/freelancer/:freelancerId/rating', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('fid', sql.Int, req.params.freelancerId)
            .query(`SELECT AVG(CAST(r.Rating AS FLOAT)) AS AvgRating, COUNT(*) AS TotalReviews
                    FROM Reviews r
                    JOIN Projects p ON r.ProjectID = p.ProjectID
                    WHERE p.FreelancerID = @fid`);
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE a review
router.post('/', async (req, res) => {
    const { ProjectID, Rating, Comment } = req.body;
    if (!ProjectID || !Rating || Rating < 1 || Rating > 5) {
        return res.status(400).json({ error: 'ProjectID and a Rating (1-5) are required' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('ProjectID', sql.Int, ProjectID)
            .input('Rating', sql.Int, Rating)
            .input('Comment', sql.NVarChar, Comment || '')
            .query(`INSERT INTO Reviews (ProjectID, Rating, Comment)
                    OUTPUT INSERTED.*
                    VALUES (@ProjectID, @Rating, @Comment)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
