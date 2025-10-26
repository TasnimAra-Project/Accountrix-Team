const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Database configuration
const config = {
    host: 'localhost',
    user: 'root',
    password: 'zaqmlpP12345@asdf',
    multipleStatements: true
};

console.log('🔌 Connecting to MySQL server...\n');

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error('❌ Error connecting to MySQL:', err.message);
        console.error('\n📝 Please check:');
        console.error('   1. MySQL server is running');
        console.error('   2. Username and password are correct');
        console.error('   3. MySQL service is started\n');
        process.exit(1);
    }

    console.log('✅ Connected to MySQL server!\n');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Running database schema...\n');

    connection.query(schema, (err, results) => {
        if (err) {
            console.error('❌ Error creating database schema:', err.message);
            connection.end();
            process.exit(1);
        }

        console.log('✅ Database schema created successfully!\n');
        console.log('📊 Database: student_teacher_db');
        console.log('📋 Tables created:');
        console.log('   - users');
        console.log('   - classes');
        console.log('   - teams');
        console.log('   - team_members');
        console.log('   - tasks');
        console.log('   - task_assignments');
        console.log('   - task_submissions');
        console.log('   - submission_files');
        console.log('   - messages');
        console.log('   - notes');
        console.log('   - note_attachments');
        console.log('   - files\n');

        console.log('🎉 MySQL connection established and database ready!\n');
        
        connection.end();
    });
});

