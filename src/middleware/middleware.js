const { verifyToken } = require('../auth');

function authenticate(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.status(401).send('Токен не предоставлен');

	const token = authHeader.split(' ')[1];
	try {
		const payload = verifyToken(token);
		req.user = payload; // Добавляем данные из токена в req.user
		next();
	} catch (err) {
		console.error('Ошибка токена:', err.message);
		return res.status(403).send('Неверный или просроченный токен');
	}
}

module.exports = { authenticate };
