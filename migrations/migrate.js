const db = require('../src/db/db'); // Подключение к MySQL
const fs = require('fs');
const path = require('path');

// Путь к файлу миграции
const migrationFile = path.join(
	__dirname,
	'db',
	'../migrations.sql'
);

// Чтение SQL-запросов из файла
const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

// Выполнение миграции
db.query(migrationSQL, (err, result) => {
	if (err) {
		console.error('Error running migrations:', err.message);
	} else {
		console.log('Migrations applied successfully!');
	}
	db.end(); // Закрытие соединения с базой данных
});
