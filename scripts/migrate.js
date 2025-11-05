// scripts/migrate.js
// Pure Node migration script (no mysql CLI needed) for Render deployment
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  try {
    // Use environment variables for database connection
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_teacher_db',
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL database');
    console.log(`   Database: ${process.env.DB_NAME || 'student_teacher_db'}`);
    console.log('');

    // Step 1: Run migrate-classes.js logic (add expiry_date column if needed)
    console.log('▶ Checking for expiry_date column in classes table...');
    
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'classes' 
        AND COLUMN_NAME = 'expiry_date'
      `, [process.env.DB_NAME || 'student_teacher_db']);

      if (columns.length > 0) {
        console.log('ℹ️  Column "expiry_date" already exists in classes table');
      } else {
        console.log('📋 Adding "expiry_date" column to classes table...');
        await conn.query(`
          ALTER TABLE classes 
          ADD COLUMN expiry_date DATE NULL 
          AFTER teacher_id
        `);
        console.log('✅ Successfully added "expiry_date" column');
      }
    } catch (err) {
      // If table doesn't exist yet, that's okay - schema.sql will create it
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️  Classes table does not exist yet (will be created by schema.sql)');
      } else {
        throw err;
      }
    }

    console.log('');

    // Step 2: Apply progress_schema.sql
    const sqlFile = path.join(__dirname, '../backend/database/progress_schema.sql');
    if (fs.existsSync(sqlFile)) {
      console.log('▶ Applying progress_schema.sql...');
      const sql = fs.readFileSync(sqlFile, 'utf8');
      
      // Remove USE statement if present (we're already connected to the database)
      const cleanSql = sql.replace(/^USE\s+\w+;?\s*/i, '');
      
      await conn.query(cleanSql);
      console.log('✅ Progress schema applied successfully');
    } else {
      console.log('ℹ️  No progress_schema.sql found, skipping.');
    }

    await conn.end();
    console.log('');
    console.log('✅ Migrations finished.');
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error('❌ Migration failed:', err.message);
    if (err.code) {
      console.error(`   Error code: ${err.code}`);
    }
    console.error('');
    process.exit(1);
  }
})();

