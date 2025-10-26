const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'zaqmlpP12345@asdf',
    database: process.env.DB_NAME || 'student_teacher_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisified version for async/await
const promisePool = pool.promise();

module.exports = promisePool;

