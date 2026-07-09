// db.js — Handles the connection pool to Azure SQL Database
const sql = require('mssql');
require('dotenv').config();

// Validate required DB environment variables early and clearly
const requiredVars = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.warn(`⚠️  Database config incomplete — missing: ${missingVars.join(', ')}`);
    console.warn('   API routes that need the database will return 503 until these are set.');
    console.warn('   Set them in Azure Portal → App Service → Configuration → Application settings');
}

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true, // required for Azure SQL
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

function getPool() {
    // Fail fast with a clear message if DB credentials are missing
    if (missingVars.length > 0) {
        return Promise.reject(new Error(
            `Database not configured — missing environment variables: ${missingVars.join(', ')}. ` +
            'Add them in Azure Portal → App Service → Configuration → Application settings.'
        ));
    }

    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log('✅ Connected to Azure SQL Database');
                return pool;
            })
            .catch(err => {
                console.error('❌ Database connection failed:', err.message);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

module.exports = { sql, getPool };
