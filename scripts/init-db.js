// Creates tables and seeds an admin user.
// Usage:  npm run init-db
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
console.log("→ Running schema.sql...");
await conn.query(sql);
await conn.changeUser({ database: process.env.DB_NAME || "flatfinder" });

const [exists] = await conn.execute("SELECT id FROM users WHERE email = ?", ["admin@flatfinder.local"]);
if (!exists.length) {
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash("admin123", 12);
  await conn.execute(
    "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'admin')",
    [id, "Admin", "admin@flatfinder.local", hash]
  );
  console.log("✅ Created admin user → admin@flatfinder.local / admin123  (CHANGE THIS!)");
} else {
  console.log("ℹ Admin user already exists, skipping.");
}

await conn.end();
console.log("🎉 Database initialized.");
