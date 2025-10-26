// Test server startup with hardcoded environment variables
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'zaqmlpP12345@asdf';
process.env.DB_NAME = 'student_teacher_db';
process.env.JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production_12345';
process.env.PORT = 3000;

console.log('🔧 Testing server with hardcoded environment variables...');
console.log('Environment variables set:');
console.log('- DB_HOST:', process.env.DB_HOST);
console.log('- DB_USER:', process.env.DB_USER);
console.log('- DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET ✓' : 'NOT SET ✗');
console.log('- DB_NAME:', process.env.DB_NAME);
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗');
console.log('- PORT:', process.env.PORT);

// Test database connection
const db = require('./backend/config/database');

async function testServer() {
    try {
        // Test database connection
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        console.log('✅ Database connection successful:', rows[0].result);
        
        console.log('🎉 Server configuration is ready!');
        console.log('📝 You can now run: npm start');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
    
    process.exit(0);
}

testServer();


