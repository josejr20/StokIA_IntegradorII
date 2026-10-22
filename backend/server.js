require('dotenv').config();
const { start } = require('./src/app');

start();

/* verificar que lso datos del .env lleguen correctamente 
console.log('CWD:', process.cwd());
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('PASS length:', process.env.DB_PASSWORD?.length);*/