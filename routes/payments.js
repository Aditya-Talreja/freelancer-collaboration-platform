// routes/payments.js
// NOTE: This simulates a payment gateway in "test mode" for course-project purposes.
// In a full production build, the POST /pay endpoint would instead be called by a
// Stripe/Razorpay webhook, orchestrated through Azure Logic Apps.

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// GET all payments for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('pid', sql.Int, req.params.projectId)
            .query('SELECT * FROM Payments WHERE ProjectID = @pid ORDER BY PaymentDate DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE a pending payment (invoice generated)
router.post('/', async (req, res) => {
    const { ProjectID, Amount } = req.body;
    if (!ProjectID || !Amount) {
        return res.status(400).json({ error: 'ProjectID and Amount are required' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('ProjectID', sql.Int, ProjectID)
            .input('Amount', sql.Decimal(10, 2), Amount)
            .input('Status', sql.NVarChar, 'Pending')
            .query(`INSERT INTO Payments (ProjectID, Amount, Status)
                    OUTPUT INSERTED.*
                    VALUES (@ProjectID, @Amount, @Status)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SIMULATE payment completion (stand-in for gateway webhook)
router.put('/:id/pay', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('Status', sql.NVarChar, 'Completed')
            .query(`UPDATE Payments SET Status = @Status
                    OUTPUT INSERTED.*
                    WHERE PaymentID = @id`);
        if (result.recordset.length === 0) return res.status(404).json({ error: 'Payment not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
