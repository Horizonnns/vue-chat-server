const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const chatRoutes = require('./routes/chat');
const db = require('./db/db.js'); // Импорт подключения к MySQL

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*', // Разрешает подключение с любого источника
		methods: ['GET', 'POST'],
	},
});

// Middleware
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads')); // Доступ к файлам
app.use('/api/chat', chatRoutes); // Роуты API

const rooms = {}; // Хранилище для комнат и пользователей
const users = {}; // { userName: { socketId, lastSeen, isOnline } }

// Socket.IO события
io.on('connection', (socket) => {
	console.log(`User connected: ${socket.id}`);

	// Когда пользователь подключается
	socket.on('user_connected', (userName) => {
		users[userName] = {
			socketId: socket.id,
			lastSeen: null,
			isOnline: true,
		};
		io.emit('update_users', users); // Обновляем статус всех пользователей
	});

	// Обрабатываем подключение нового пользователя
	socket.on('join', (data) => {
		const userName = data.userName || 'Гость';
		// Рассылаем сообщение о подключении

		console.log(`User joined: ${userName}`); // Логируем имя пользователя
		socket.broadcast.emit('user_connected', userName);
	});

	socket.on('user_connected', (user) => {
		console.log('New user connected:', user); // Логируем имя нового пользователя
		this.showConnectedUser(user);
	});

	socket.on('send_message', async (message) => {
		try {
			console.log('New message:', message);
			io.emit('new_message', message);

			// Сохранение сообщения в базу
			await pool.query(
				'INSERT INTO messages (sender_id, content) VALUES ($1, $2)',
				[message.sender, message.text]
			);
		} catch (error) {
			console.error('Error saving message:', error);
			io.emit('error', { message: 'Failed to save message' });
		}
	});

	socket.on('send_file', (fileData) => {
		console.log('New file received:', fileData.fileName);
		io.emit('new_file', fileData); // Рассылка файла всем
	});

	socket.on('disconnect', () => {
		console.log('User disconnected:', socket.id);
	});
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
	console.log(`Server running on http://localhost:${PORT}`)
);
