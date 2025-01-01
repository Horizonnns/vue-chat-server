const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { generateToken, verifyToken } = require('./src/auth');
const { authenticate } = require('./src/middleware/middleware');

async function initDB() {
	const db = await open({
		filename: './chat.db',
		driver: sqlite3.Database,
	});

	// Создание таблиц
	await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
			last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

	await db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (contact_id) REFERENCES users (id),
      UNIQUE (user_id, contact_id)
    );
  `);

	await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id)
    );
  `);

	return db;
}

async function main() {
	const app = express();
	const server = createServer(app);
	const io = new Server(server, {
		cors: {
			origin: 'http://localhost:5173',
			methods: ['GET', 'POST'],
		},
	});

	app.use(
		cors({
			origin: 'http://localhost:5173', // Ваш адрес фронтенда
			methods: ['GET', 'POST'],
			allowedHeaders: ['Content-Type', 'Authorization'], // Разрешите заголовок Authorization
		})
	);

	app.use(express.json());
	const db = await initDB();

	// Регистрация
	app.post('/register', async (req, res) => {
		const { name, phone, password } = req.body;
		if (!name || !phone || !password)
			return res.status(400).send('Все поля обязательны');

		try {
			const hashedPassword = await bcrypt.hash(password, 10);
			const result = await db.run(
				'INSERT INTO users (name, phone, password) VALUES (?, ?, ?)',
				[name, phone, hashedPassword]
			);

			res.status(201).send('Регистрация успешна');
		} catch (err) {
			res.status(400).send('Пользователь с таким номером уже существует');
		}
	});

	// Вход
	app.post('/login', async (req, res) => {
		const { phone, password } = req.body;
		const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);

		if (!user || !(await bcrypt.compare(password, user.password))) {
			return res.status(401).send('Неверные телефон или пароль');
		}

		// Генерация токена
		const token = generateToken({ id: user.id });

		// Удаление пароля из объекта пользователя перед отправкой
		const { password: _, ...userData } = user;

		// Ответ с токеном и данными пользователя
		res.status(200).json({ token, user: userData });
	});

	// Поиск пользователя по номеру телефона
	app.get('/search', authenticate, async (req, res) => {
		const { phone } = req.query;

		try {
			const user = await db.get(
				'SELECT id, name, phone FROM users WHERE phone = ?',
				[phone]
			);

			if (!user) {
				return res.status(404).send('Пользователь не найден');
			}

			res.status(200).json(user);
		} catch (err) {
			console.error('Ошибка при поиске пользователя:', err);
			res.status(500).send('Ошибка сервера');
		}
	});

	// Добавление контакта
	app.post('/add-contact', authenticate, async (req, res) => {
		const { contactPhone } = req.body;
		const userId = req.user.id;

		const contact = await db.get('SELECT id FROM users WHERE phone = ?', [
			contactPhone,
		]);

		if (!contact) {
			return res.status(404).send('Пользователь не найден');
		}

		// Проверяем, не совпадает ли пользователь с самим собой
		if (contact.id === userId) {
			return res.status(400).send('Невозможно добавить самого себя в контакты');
		}

		try {
			await db.run('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)', [
				userId,
				contact.id,
			]);
			await db.run('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)', [
				contact.id,
				userId,
			]);
			res.status(201).send('Контакт успешно добавлен');
		} catch {
			res.status(400).send('Контакт уже существует');
		}
	});

	// Получение списка контактов
	app.get('/contacts/:userId', authenticate, async (req, res) => {
		const { userId } = req.params;

		if (Number(userId) !== req.user.id) {
			return res.status(403).send('Нет доступа');
		}

		try {
			const contacts = await db.all(
				`
      SELECT u.id, u.name, u.phone
      FROM contacts c
      JOIN users u ON c.contact_id = u.id
      WHERE c.user_id = ?
    `,
				[userId]
			);

			res.status(200).json(contacts);
		} catch (err) {
			console.error('Ошибка при получении контактов:', err);
			res.status(500).send('Ошибка сервера');
		}
	});

	app.get('/status/:userId', authenticate, async (req, res) => {
		const { userId } = req.params;

		try {
			const user = await db.get('SELECT last_seen FROM users WHERE id = ?', [
				userId,
			]);
			if (!user) return res.status(404).send('Пользователь не найден');

			const isOnline = userSockets.has(userId);
			res.status(200).json({ isOnline, lastSeen: user.last_seen });
		} catch (err) {
			console.error('Ошибка получения статуса:', err);
			res.status(500).send('Ошибка сервера');
		}
	});

	// Получение сообщений между двумя пользователями
	app.get('/messages', authenticate, async (req, res) => {
		const { contactId } = req.query;

		// userId берется из токена
		const userId = req.user.id;

		if (!contactId) {
			return res.status(400).send('Необходимо указать contactId');
		}

		try {
			const messages = await db.all(
				`
      SELECT 
        m.id, 
        m.sender_id AS senderId, 
        m.receiver_id AS receiverId, 
        m.content, 
        m.timestamp
      FROM messages m
      WHERE 
        (m.sender_id = ? AND m.receiver_id = ?)
        OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.timestamp ASC
      `,
				[userId, contactId, contactId, userId]
			);

			res.status(200).json(messages);
		} catch (err) {
			console.error('Ошибка при получении сообщений:', err);
			res.status(500).send('Ошибка сервера');
		}
	});

	// Сопоставление userId с сокетами
	const userSockets = new Map();

	// Обработка сокетов на сервере
	io.on('connection', (socket) => {
		// Получение userId из handshake
		const userId = socket.handshake.query.userId;
		if (!userId) {
			socket.disconnect(true);
			return;
		}

		// Сохраняем связь между userId и сокетом
		userSockets.set(userId, socket);
		console.log(`User ${userId} connected`);

		// Обновляем last_seen при подключении
		db.run('UPDATE users SET last_seen = ? WHERE id = ?', [
			new Date().toISOString(),
			userId,
		]);

		// Убираем пользователя из карты при отключении
		socket.on('disconnect', () => {
			userSockets.delete(userId);
			console.log(`User ${userId} disconnected`);

			// Обновляем last_seen при отключении
			db.run('UPDATE users SET last_seen = ? WHERE id = ?', [
				new Date().toISOString(),
				userId,
			]);
		});

		// Обработка отправки сообщения
		socket.on('send message', async ({ senderId, receiverId, content }) => {
			try {
				const timestamp = new Date().toISOString(); // Добавляем timestamp
				const receiver = await db.get('SELECT id FROM users WHERE id = ?', [
					receiverId,
				]); // Проверяем, что получатель существует

				if (!receiver) {
					socket.emit('error', 'Получатель не найден');
					return;
				}

				await db.run(
					'INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)',
					[senderId, receiver.id, content, timestamp]
				); // Сохраняем сообщение в базе данных

				const message = { senderId, content, timestamp };

				const receiverSocket = userSockets.get(String(receiver.id));
				if (receiverSocket) {
					receiverSocket.emit('receive message', message);
				} // Отправляем сообщение получателю, если он в сети

				socket.emit('message sent', { receiverId, content, timestamp }); // Отправляем подтверждение отправителю
			} catch (err) {
				console.error('Ошибка при отправке сообщения:', err);
				socket.emit('error', 'Ошибка при отправке сообщения');
			}
		});
	});

	server.listen(3000, () => {
		console.log('Server running on http://localhost:3000');
	});
}

main().catch((err) => console.error('Error starting server:', err));
