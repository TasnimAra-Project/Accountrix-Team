const db = require('./config/database');

console.log('🔌 Testing MySQL connection...\n');

async function testConnection() {
    try {
        // Test the connection
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        console.log('✅ MySQL connection successful!');
        console.log('✅ Test query result:', rows[0].result);
        
        // Check if database exists
        const [databases] = await db.query('SHOW DATABASES LIKE "student_teacher_db"');
        if (databases.length > 0) {
            console.log('✅ Database "student_teacher_db" exists');
            
            // Check tables
            const [tables] = await db.query('SHOW TABLES FROM student_teacher_db');
            console.log(`✅ Found ${tables.length} tables in database`);
            
            if (tables.length > 0) {
                console.log('\n📋 Tables:');
                tables.forEach(table => {
                    console.log('   -', Object.values(table)[0]);
                });
            } else {
                console.log('⚠️  No tables found. Run setup-database.js to create tables.');
            }
        } else {
            console.log('⚠️  Database "student_teacher_db" does not exist');
            console.log('📝 Run: node backend/setup-database.js');
        }
        
        console.log('\n🎉 Connection test completed!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('\n📝 Please check:');
        console.error('   1. MySQL server is running');
        console.error('   2. Database credentials in backend/config/database.js');
        console.error('   3. MySQL service is started');
        console.error('\n💡 To start MySQL on Windows:');
        console.error('   net start MySQL80\n');
        process.exit(1);
    }
}

testConnection();

