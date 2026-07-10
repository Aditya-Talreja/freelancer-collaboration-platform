// server.js — Main entry point for the Freelancer Collaboration Platform backend
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ===== Global error handlers — prevent silent crashes on Azure =====
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 8080;

// ===== Startup diagnostics — helps debug in Azure Log Stream =====
console.log('--- Startup Diagnostics ---');
console.log('Node version:', process.version);
console.log('PORT:', PORT);
console.log('DB_SERVER:', process.env.DB_SERVER ? '✅ set' : '❌ MISSING');
console.log('DB_NAME:', process.env.DB_NAME ? '✅ set' : '❌ MISSING');
console.log('DB_USER:', process.env.DB_USER ? '✅ set' : '❌ MISSING');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ set' : '❌ MISSING');
console.log('AZURE_STORAGE_CONNECTION_STRING:', process.env.AZURE_STORAGE_CONNECTION_STRING ? '✅ set' : '❌ MISSING');
console.log('AZURE_STORAGE_CONTAINER:', process.env.AZURE_STORAGE_CONTAINER || '(default: project-files)');
console.log('AZURE_FUNCTION_CALC_HOURS_URL:', process.env.AZURE_FUNCTION_CALC_HOURS_URL ? '✅ set' : '⚠️  MISSING (will use local calculation)');
console.log('---------------------------');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== API Routes =====
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/timelogs', require('./routes/timelogs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/files', require('./routes/files'));

// Health check (useful for confirming the App Service + DB connection are alive)
app.get('/api/health', async (req, res) => {
    try {
        const { getPool } = require('./db');
        await getPool();
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
    }
});

// Serve the frontend for any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Freelancer Platform running on port ${PORT}`);
});
