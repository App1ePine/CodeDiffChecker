CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  created_at INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shares (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  slug VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  left_content MEDIUMTEXT NOT NULL,
  right_content MEDIUMTEXT NOT NULL,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  expires_at INT UNSIGNED NULL DEFAULT NULL,
  created_at INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at INT UNSIGNED NOT NULL DEFAULT 0,
  deleted_at INT UNSIGNED NULL DEFAULT NULL,
  CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_shares_user_id ON shares (user_id);
CREATE INDEX idx_shares_expires_at ON shares (expires_at);
CREATE INDEX idx_shares_deleted_at ON shares (deleted_at);

INSERT INTO users (username, email, password_hash, nickname, created_at, updated_at)
VALUES ('admin',
        'admin@example.com',
        '$2a$10$fi5eHDfbZLAfjrNI6a93x.rz7e2ljd90ExbI4.vOhxU4uH/C2z4oS',
        '系统管理员',
        UNIX_TIMESTAMP(),
        UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE nickname   = VALUES(nickname),
                        updated_at = UNIX_TIMESTAMP();
