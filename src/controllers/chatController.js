const pool = require('../db/db');

// Сохранение сообщения в базу данных
async function saveMessage(req, res) {
	const { sender, text } = req.body;
	try {
		const result = await pool.query(
			'INSERT INTO messages (sender_id, content) VALUES ($1, $2) RETURNING *',
			[sender, text]
		);
		res.status(200).json(result.rows[0]);
	} catch (error) {
		console.error('Error saving message:', error);
		res.status(500).json({ error: 'Failed to save message' });
	}
}

// Получение всех сообщений
async function getMessages(req, res) {
	try {
		const result = await pool.query(
			'SELECT * FROM messages ORDER BY created_at DESC'
		);
		res.status(200).json(result.rows);
	} catch (error) {
		console.error('Error fetching messages:', error);
		res.status(500).json({ error: 'Failed to fetch messages' });
	}
}

module.exports = { saveMessage, getMessages };
