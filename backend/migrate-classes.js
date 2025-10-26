const mysql = require('mysql2');

// Database configuration
const config = {
    host: 'localhost',
    user: 'root',
    password: 'zaqmlpP12345@asdf',
    database: 'student_teacher_db'
};

console.log('🔄 Starting database migration for classes table...\n');

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error('❌ Error connecting to MySQL:', err.message);
        console.error('\n📝 Please check:');
        console.error('   1. MySQL server is running');
        console.error('   2. Database "student_teacher_db" exists');
        console.error('   3. Username and password are correct\n');
        process.exit(1);
    }

    console.log('✅ Connected to MySQL database!\n');

    // Check if expiry_date column exists
    const checkColumnQuery = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'student_teacher_db' 
        AND TABLE_NAME = 'classes' 
        AND COLUMN_NAME = 'expiry_date'
    `;

    connection.query(checkColumnQuery, (err, results) => {
        if (err) {
            console.error('❌ Error checking column:', err.message);
            connection.end();
            process.exit(1);
        }

        if (results.length > 0) {
            console.log('ℹ️  Column "expiry_date" already exists in classes table');
            console.log('✅ No migration needed!\n');
            connection.end();
            process.exit(0);
        }

        // Add the column
        console.log('📋 Adding "expiry_date" column to classes table...\n');
        
        const addColumnQuery = `
            ALTER TABLE classes 
            ADD COLUMN expiry_date DATE NULL 
            AFTER teacher_id
        `;

        connection.query(addColumnQuery, (err) => {
            if (err) {
                console.error('❌ Error adding column:', err.message);
                connection.end();
                process.exit(1);
            }

            console.log('✅ Successfully added "expiry_date" column to classes table!');
            console.log('✅ Migration completed!\n');
            
            connection.end();
            process.exit(0);
        });
    });
});

