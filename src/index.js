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

	// Когда пользователь отключается
	socket.on('disconnect', () => {
		const user = Object.keys(users).find(
			(key) => users[key].socketId === socket.id
		);

		if (user) {
			users[user].isOnline = false;
			users[user].lastSeen = new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false, // 24-часовой формат
			}); // Устанавливаем время последнего выхода

			io.emit('update_users', users); // Обновляем статус всех пользователей
		}
	});

	// Создание комнаты с паролем
	socket.on('create_room', ({ userName, password }, callback) => {
		if (rooms[password]) {
			return callback({
				success: false,
				message: 'Комната с таким паролем уже существует.',
			});
		}

		rooms[password] = {
			users: [userName],
			creator: userName,
			creatorStatus: users[userName], // Сохраняем статус создателя из users
		}; // Сохраняем создателя комнаты

		socket.data.userName = userName; // Сохраняем имя пользователя
		rooms[password].users.push(userName);

		socket.join(password); // Подключаем пользователя к комнате
		console.log(`Room created: ${password} by ${userName}`);

		io.to(password).emit('user_joined', userName); // Уведомляем участников в комнате о новом участнике
		callback({
			success: true,
			creator: userName,
			creatorStatus: users[userName],
		}); // Отправляем данные создателя клиенту
	});

	// Подключение к комнате по паролю
	socket.on('join_room', ({ userName, password }, callback) => {
		const room = rooms[password];

		if (!room) {
			return callback({
				success: false,
				message: 'Комната с таким паролем не существует.',
			});
		}

		if (room.users.includes(userName)) {
			return callback({
				success: false,
				message: 'Пользователь с таким именем уже подключен.',
			});
		}

		socket.data.userName = userName; // Сохраняем имя пользователя
		room.users.push(userName); // Добавляем пользователя в комнату
		socket.join(password); // Подключаем пользователя к комнате
		console.log(`${userName} joined room: ${password}`);

		// Передаем имя и статус создателя новому участнику
		callback({
			success: true,
			creator: room.creator,
			creatorStatus: users[room.creator], // Передаем статус создателя
		});

		// Уведомляем остальных пользователей в комнате о новом участнике
		socket.to(password).emit('user_joined', userName);
	});

	// Отправка сообщения в комнату
	socket.on('send_message', ({ password, userName, message, currentTime }) => {
		const room = rooms[password];
		if (room) {
			console.log(`Message from ${userName} in room ${password}: ${message}`);
			io.to(password).emit('new_message', {
				userName,
				message,
				time: currentTime,
			}); // Добавляем поле time
		}
	});

	// Обрабатываем подключение нового пользователя
	socket.on('join', (data) => {
		const userName = data.userName || 'Гость';
		console.log(`User joined: ${userName}`); // Логируем имя пользователя
		socket.broadcast.emit('user_connected', userName);
	});

	// Отправка файлов
	socket.on('send_file', (fileData) => {
		console.log('New file received:', fileData.fileName);
		io.emit('new_file', fileData); // Рассылка файла всем
	});

	// Пользователь покидает комнату
	socket.on('leave_room', ({ userName, password }) => {
		if (rooms[password]) {
			rooms[password].users = rooms[password].users.filter(
				(user) => user !== userName
			);
			io.to(password).emit('user_left', userName);
			if (rooms[password].users.length === 0) {
				delete rooms[password]; // Удаляем комнату, если она пуста
			}
		}
	});

	// Удаление комнаты (создателем)
	socket.on('delete_room', ({ password }) => {
		if (rooms[password]) {
			io.to(password).emit('room_deleted');
			delete rooms[password]; // Удаляем комнату
		}
	});
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
	console.log(`Server running on http://localhost:${PORT}`)
);
