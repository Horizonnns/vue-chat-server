const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// Получение списка чатов
router.get('/chats', async (req, res) => {
	try {
		const result = await pool.query(
			'SELECT id, name, last_message, updated_at FROM chats ORDER BY updated_at DESC'
		);
		res.status(200).json(result.rows);
	} catch (error) {
		console.error('Error fetching chats:', error);
		res.status(500).json({ error: 'Failed to fetch chats' });
	}
});

// Получение сообщений конкретного чата
router.get('/chats/:id/messages', async (req, res) => {
	const { id } = req.params;
	try {
		const chatResult = await pool.query(
			'SELECT name FROM chats WHERE id = $1',
			[id]
		);
		const messagesResult = await pool.query(
			'SELECT id, sender_id, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
			[id]
		);

		if (chatResult.rowCount === 0) {
			return res.status(404).json({ error: 'Chat not found' });
		}

		res.status(200).json({
			name: chatResult.rows[0].name,
			messages: messagesResult.rows,
		});
	} catch (error) {
		console.error('Error fetching messages:', error);
		res.status(500).json({ error: 'Failed to fetch messages' });
	}
});

// Создание нового чата
router.post('/chats', async (req, res) => {
	const { name } = req.body;
	try {
		const result = await pool.query(
			'INSERT INTO chats (name) VALUES ($1) RETURNING id, name, last_message, updated_at',
			[name]
		);
		res.status(201).json(result.rows[0]);
	} catch (error) {
		console.error('Error creating chat:', error);
		res.status(500).json({ error: 'Failed to create chat' });
	}
});

// Отправка сообщения в чат
router.post('/chats/:id/messages', async (req, res) => {
	const { id } = req.params;
	const { sender_id, content } = req.body;

	try {
		// Добавляем сообщение в базу данных
		await pool.query(
			'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)',
			[id, sender_id, content]
		);

		// Обновляем информацию о последнем сообщении в чате
		await pool.query(
			'UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2',
			[content, id]
		);

		res.status(201).json({ message: 'Message sent successfully' });
	} catch (error) {
		console.error('Error sending message:', error);
		res.status(500).json({ error: 'Failed to send message' });
	}
});

module.exports = router;
