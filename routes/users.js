// routes/users.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// GET all users
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Users ORDER BY UserID DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single user
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Users WHERE UserID = @id');
        if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE user (signup / create profile)
router.post('/', async (req, res) => {
    const { Name, Email, Role, Bio, PortfolioLink } = req.body;
    if (!Name || !Email || !Role) {
        return res.status(400).json({ error: 'Name, Email, and Role are required' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Email', sql.NVarChar, Email)
            .input('Role', sql.NVarChar, Role)
            .input('Bio', sql.NVarChar, Bio || '')
            .input('PortfolioLink', sql.NVarChar, PortfolioLink || '')
            .query(`INSERT INTO Users (Name, Email, Role, Bio, PortfolioLink)
                    OUTPUT INSERTED.*
                    VALUES (@Name, @Email, @Role, @Bio, @PortfolioLink)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE user profile
router.put('/:id', async (req, res) => {
    const { Name, Bio, PortfolioLink } = req.body;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('Name', sql.NVarChar, Name)
            .input('Bio', sql.NVarChar, Bio)
            .input('PortfolioLink', sql.NVarChar, PortfolioLink)
            .query(`UPDATE Users SET Name = @Name, Bio = @Bio, PortfolioLink = @PortfolioLink
                    OUTPUT INSERTED.*
                    WHERE UserID = @id`);
        if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE user profile
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        // Nullify FreelancerID references so FK constraints don't block the delete
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Projects SET FreelancerID = NULL WHERE FreelancerID = @id');
        // Attempt the delete (may still fail if user is a ClientID on projects)
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Users WHERE UserID = @id');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Profile deleted' });
    } catch (err) {
        // FK constraint from Projects.ClientID or other tables
        if (err.number === 547) {
            return res.status(409).json({
                error: 'Cannot delete this profile — they are linked as a client on existing projects. Remove or reassign those projects first.'
            });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
