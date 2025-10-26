const mysql = require('mysql2');

console.log('🔌 Testing MySQL Connection...\n');

// Test different connection configurations
const configs = [
    {
        name: 'localhost with database',
        config: {
            host: 'localhost',
            user: 'root',
            password: 'zaqmlpP12345@asdf',
            database: 'student_teacher_db'
        }
    },
    {
        name: 'localhost without database',
        config: {
            host: 'localhost',
            user: 'root',
            password: 'zaqmlpP12345@asdf'
        }
    },
    {
        name: '127.0.0.1 with database',
        config: {
            host: '127.0.0.1',
            user: 'root',
            password: 'zaqmlpP12345@asdf',
            database: 'student_teacher_db'
        }
    },
    {
        name: '127.0.0.1 without database',
        config: {
            host: '127.0.0.1',
            user: 'root',
            password: 'zaqmlpP12345@asdf'
        }
    }
];

async function testConnection(config) {
    return new Promise((resolve) => {
        console.log(`Testing: ${config.name}...`);
        
        const connection = mysql.createConnection(config.config);
        
        connection.connect((err) => {
            if (err) {
                console.log(`❌ ${config.name}: ${err.message}`);
                resolve(false);
            } else {
                console.log(`✅ ${config.name}: Connected successfully!`);
                
                // Test a simple query
                connection.query('SELECT 1 + 1 AS result', (err, results) => {
                    if (err) {
                        console.log(`   Query failed: ${err.message}`);
                        resolve(false);
                    } else {
                        console.log(`   Query result: ${results[0].result}`);
                        
                        // Check if database exists
                        connection.query('SHOW DATABASES LIKE "student_teacher_db"', (err, results) => {
                            if (err) {
                                console.log(`   Database check failed: ${err.message}`);
                            } else if (results.length > 0) {
                                console.log(`   ✅ Database "student_teacher_db" exists`);
                            } else {
                                console.log(`   ⚠️  Database "student_teacher_db" does not exist`);
                            }
                            
                            connection.end();
                            resolve(true);
                        });
                    }
                });
            }
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            console.log(`⏰ ${config.name}: Connection timeout`);
            connection.end();
            resolve(false);
        }, 5000);
    });
}

async function runTests() {
    console.log('Starting connection tests...\n');
    
    let success = false;
    for (const config of configs) {
        const result = await testConnection(config);
        if (result) success = true;
        console.log(''); // Empty line
    }
    
    if (success) {
        console.log('🎉 At least one connection method works!');
        console.log('📝 You can now proceed with database setup.');
    } else {
        console.log('❌ All connection attempts failed.');
        console.log('\n📝 Troubleshooting steps:');
        console.log('1. Make sure MySQL service is running');
        console.log('2. Check if the password is correct');
        console.log('3. Verify MySQL is listening on port 3306');
        console.log('4. Try connecting through MySQL Workbench first');
    }
    
    process.exit(success ? 0 : 1);
}

runTests();
