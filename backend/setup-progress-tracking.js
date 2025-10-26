const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function setupProgressTracking() {
    try {
        console.log('📊 Setting up AI Progress Tracking...\n');

        // Read the SQL file
        const sqlFile = path.join(__dirname, 'database', 'progress_schema.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        // Split by semicolons to execute individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`Found ${statements.length} SQL statements to execute...\n`);

        let executed = 0;
        for (const statement of statements) {
            try {
                await db.query(statement);
                executed++;
                
                // Log table creation
                if (statement.includes('CREATE TABLE')) {
                    const match = statement.match(/CREATE TABLE.*?`?(\w+)`?/i);
                    if (match) {
                        console.log(`✅ Created table: ${match[1]}`);
                    }
                }
                
                // Log view creation
                if (statement.includes('CREATE OR REPLACE VIEW')) {
                    const match = statement.match(/VIEW\s+(\w+)/i);
                    if (match) {
                        console.log(`✅ Created view: ${match[1]}`);
                    }
                }
            } catch (error) {
                // Ignore "already exists" errors
                if (!error.message.includes('already exists')) {
                    console.error(`⚠️  Warning: ${error.message}`);
                }
            }
        }

        console.log(`\n✅ Successfully executed ${executed} statements\n`);

        // Verify tables exist
        console.log('🔍 Verifying tables...\n');
        
        const [tables] = await db.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'student_teacher_db' 
            AND TABLE_NAME IN ('team_metrics', 'task_events', 'team_insights')
        `);

        if (tables.length === 3) {
            console.log('✅ All required tables exist:');
            tables.forEach(t => console.log(`   - ${t.TABLE_NAME}`));
            
            console.log('\n✅ AI Progress Tracking setup complete!');
            console.log('\n📝 Next steps:');
            console.log('   1. Start the server: npm start');
            console.log('   2. Login as a teacher');
            console.log('   3. Click on a class');
            console.log('   4. View "AI Progress Tracking" section\n');
        } else {
            console.log('⚠️  Warning: Some tables are missing');
            console.log('Found:', tables.map(t => t.TABLE_NAME).join(', '));
        }

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    } finally {
        if (db && db.end) {
            await db.end();
        }
    }
}

setupProgressTracking();

