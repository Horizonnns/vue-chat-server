const db = require('../src/db/db'); // Подключение к MySQL
const fs = require('fs');
const path = require('path');

// Путь к файлу миграции
const migrationFile = path.join(__dirname, './migrations.sql');

// Чтение SQL-запросов из файла и разделение их по ";"
const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
const migrationQueries = migrationSQL
	.split(';') // Разделяем запросы по ";"
	.map((query) => query.trim()) // Убираем лишние пробелы
	.filter((query) => query.length > 0); // Убираем пустые строки

// Функция выполнения запросов по очереди
async function runMigrations() {
	try {
		for (const query of migrationQueries) {
			// Выполняем запросы последовательно с использованием Promises
			await db.query(query);
			console.log('Migration executed:', query);
		}
		console.log('Migrations applied successfully!');
	} catch (err) {
		console.error('Error running migrations:', err.message);
	} finally {
		await db.end(); // Закрываем соединение с базой данных
	}
}

// Запуск миграций
runMigrations();
