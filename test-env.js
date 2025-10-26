const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🔍 Environment Variables Test:');
console.log('Current directory:', __dirname);
console.log('Looking for .env at:', path.join(__dirname, '.env'));
console.log('');

console.log('Environment variables:');
console.log('- DB_HOST:', process.env.DB_HOST);
console.log('- DB_USER:', process.env.DB_USER);
console.log('- DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET ✓' : 'NOT SET ✗');
console.log('- DB_NAME:', process.env.DB_NAME);
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗');
console.log('- PORT:', process.env.PORT);


