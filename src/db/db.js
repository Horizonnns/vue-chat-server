const mysql = require('mysql2');
require('dotenv').config();

// Создаем соединение
const db = mysql.createConnection({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'vue-chat',
});

module.exports = db;
