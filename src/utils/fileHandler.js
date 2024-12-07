const fs = require('fs');

// Удаление файла
function deleteFile(filePath) {
	fs.unlink(filePath, (err) => {
		if (err) {
			console.error('Failed to delete file:', filePath, err);
		} else {
			console.log('File deleted:', filePath);
		}
	});
}

module.exports = { deleteFile };
