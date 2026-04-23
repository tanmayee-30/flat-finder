import { Router } from "express";
import { v4 as uuid } from "../utils/uuid.js";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/conversations", requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT c.*, f.title AS flat_title,
       uo.name AS owner_name, uu.name AS user_name,
       (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_time
     FROM conversations c
     JOIN flats f  ON f.id = c.flat_id
     JOIN users uo ON uo.id = c.owner_id
     JOIN users uu ON uu.id = c.user_id
     WHERE c.owner_id = ? OR c.user_id = ?
     ORDER BY COALESCE(last_time, c.created_at) DESC`,
    [req.user.id, req.user.id]
  );
  res.json({ conversations: rows });
});

router.post("/conversations", requireAuth, async (req, res) => {
  const { flat_id } = req.body || {};
  const flats = await query("SELECT owner_id FROM flats WHERE id = ?", [flat_id]);
  if (!flats.length) return res.status(404).json({ error: "Flat not found" });
  const owner_id = flats[0].owner_id;
  if (owner_id === req.user.id) return res.status(400).json({ error: "Cannot chat with self" });

  const existing = await query(
    "SELECT id FROM conversations WHERE flat_id = ? AND owner_id = ? AND user_id = ?",
    [flat_id, owner_id, req.user.id]
  );
  if (existing.length) return res.json({ id: existing[0].id });

  const id = uuid();
  await query(
    "INSERT INTO conversations (id, flat_id, owner_id, user_id) VALUES (?, ?, ?, ?)",
    [id, flat_id, owner_id, req.user.id]
  );
  res.json({ id });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const c = await query("SELECT owner_id, user_id FROM conversations WHERE id = ?", [req.params.id]);
  if (!c.length) return res.status(404).json({ error: "Not found" });
  if (c[0].owner_id !== req.user.id && c[0].user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const rows = await query(
    "SELECT id, sender_id, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [req.params.id]
  );
  res.json({ messages: rows });
});

router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: "Empty message" });
  const c = await query("SELECT owner_id, user_id FROM conversations WHERE id = ?", [req.params.id]);
  if (!c.length) return res.status(404).json({ error: "Not found" });
  if (c[0].owner_id !== req.user.id && c[0].user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const id = uuid();
  await query(
    "INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)",
    [id, req.params.id, req.user.id, content.trim()]
  );
  // Broadcast over WS if available
  if (global.wsBroadcast) global.wsBroadcast(req.params.id, { id, sender_id: req.user.id, content: content.trim(), created_at: new Date().toISOString() });
  res.json({ id });
});

export default router;
