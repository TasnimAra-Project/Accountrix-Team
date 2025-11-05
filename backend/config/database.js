const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration for hosted DBs (Railway, PlanetScale, etc.)
// Never default to localhost in production
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.DB_HOST || process.env.MYSQL_HOST || (isProduction ? null : 'localhost');
const port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
const user = process.env.DB_USER || process.env.MYSQL_USER || (isProduction ? null : 'root');
const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || (isProduction ? null : 'student_teacher_db');

// Validate required config in production
if (isProduction && (!host || !user || !database)) {
    console.error('❌ Missing required database environment variables in production:');
    console.error('   DB_HOST:', host || 'NOT SET');
    console.error('   DB_USER:', user || 'NOT SET');
    console.error('   DB_NAME:', database || 'NOT SET');
    throw new Error('Missing required database configuration in production');
}

// SSL configuration
const forceSSL = (process.env.DB_SSL || '').toLowerCase() === 'true';
const isPlanetScale = /\.psdb\.cloud$/i.test(host);
const ssl = (forceSSL || isPlanetScale) ? { rejectUnauthorized: true } : undefined;

const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    ssl, // undefined unless SSL needed
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: 'Z'
});

// Log connection info (non-production only)
if (!isProduction) {
    console.log('[DB] host=%s port=%s db=%s ssl=%s', host, port, database, !!ssl);
}

// Quick connection probe
(async () => {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] Connected OK');
    } catch (e) {
        console.error('[DB] Connection failed:', e.message);
        if (e.code) {
            console.error('[DB] Error code:', e.code);
        }
    }
})();

module.exports = pool;

