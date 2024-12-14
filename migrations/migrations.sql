-- Таблица для пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
    -- socket_id VARCHAR(255),
    -- is_online BOOLEAN DEFAULT FALSE,
    -- last_seen DATETIME
);

-- Таблица для комнат
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    password VARCHAR(50) NOT NULL UNIQUE,
    creator_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Таблица для сообщений
CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)

    -- id INT AUTO_INCREMENT PRIMARY KEY,
    -- user_id INT NOT NULL,
    -- room_password VARCHAR(255),
    -- message TEXT NOT NULL,
    -- timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- FOREIGN KEY (user_id) REFERENCES users(id)
);