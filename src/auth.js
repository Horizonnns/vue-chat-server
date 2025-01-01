const jwt = require('jsonwebtoken');

const SECRET_KEY = 'eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9'; // Замените на безопасный ключ

// Генерация токена
function generateToken(payload) {
	return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
}

// Проверка токена
function verifyToken(token) {
	return jwt.verify(token, SECRET_KEY);
}

module.exports = { generateToken, verifyToken };
