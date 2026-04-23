-- FlatFinder MySQL Schema
CREATE DATABASE IF NOT EXISTS flatfinder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flatfinder;

CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('tenant','owner','admin') NOT NULL DEFAULT 'tenant',
  status      ENUM('active','suspended')     NOT NULL DEFAULT 'active',
  phone       VARCHAR(20),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flats (
  id          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  owner_id    CHAR(36)     NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  area        VARCHAR(100) NOT NULL,
  address     VARCHAR(300),
  price       INT NOT NULL,
  type        ENUM('1BHK','2BHK','3BHK','4BHK+','Studio','1 Room','2 Rooms') NOT NULL,
  amenities   JSON,
  image_url   VARCHAR(500),
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_at DATETIME,
  reviewed_by CHAR(36),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_flat_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id          CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  flat_id     CHAR(36)      NOT NULL,
  tenant_id   CHAR(36)      NOT NULL,
  owner_id    CHAR(36)      NOT NULL,
  check_in    DATE          NOT NULL,
  check_out   DATE          NOT NULL,
  total_rent  DECIMAL(12,2) NOT NULL,
  status      ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bk_flat   FOREIGN KEY (flat_id)   REFERENCES flats(id) ON DELETE CASCADE,
  CONSTRAINT fk_bk_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bk_owner  FOREIGN KEY (owner_id)  REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
  id         CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  flat_id    CHAR(36) NOT NULL,
  owner_id   CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_convo (flat_id, owner_id, user_id),
  CONSTRAINT fk_cv_flat  FOREIGN KEY (flat_id)  REFERENCES flats(id) ON DELETE CASCADE,
  CONSTRAINT fk_cv_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cv_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  conversation_id CHAR(36) NOT NULL,
  sender_id       CHAR(36) NOT NULL,
  content         TEXT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_convo  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)       REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_flats_status ON flats(status);
CREATE INDEX idx_flats_area   ON flats(area);
CREATE INDEX idx_flats_type   ON flats(type);
CREATE INDEX idx_msg_convo    ON messages(conversation_id);
