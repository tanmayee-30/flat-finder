import { Router } from "express";
import { v4 as uuid } from "../utils/uuid.js";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  let rows;
  if (req.user.role === "admin") {
    rows = await query(`SELECT b.*, f.title AS flat_title, f.area AS flat_area,
      ut.name AS tenant_name, uo.name AS owner_name FROM bookings b
      JOIN flats f ON f.id = b.flat_id
      JOIN users ut ON ut.id = b.tenant_id
      JOIN users uo ON uo.id = b.owner_id ORDER BY b.created_at DESC`);
  } else {
    rows = await query(`SELECT b.*, f.title AS flat_title, f.area AS flat_area,
      ut.name AS tenant_name, uo.name AS owner_name FROM bookings b
      JOIN flats f ON f.id = b.flat_id
      JOIN users ut ON ut.id = b.tenant_id
      JOIN users uo ON uo.id = b.owner_id
      WHERE b.tenant_id = ? OR b.owner_id = ? ORDER BY b.created_at DESC`,
      [req.user.id, req.user.id]);
  }
  res.json({ bookings: rows });
});

router.post("/", requireAuth, async (req, res) => {
  const { flat_id, check_in, check_out } = req.body || {};
  if (!flat_id || !check_in || !check_out) return res.status(400).json({ error: "Missing fields" });
  const flats = await query("SELECT id, owner_id, price, status FROM flats WHERE id = ?", [flat_id]);
  if (!flats.length) return res.status(404).json({ error: "Flat not found" });
  if (flats[0].status !== "approved") return res.status(400).json({ error: "Flat not bookable" });
  if (flats[0].owner_id === req.user.id) return res.status(400).json({ error: "Cannot book own flat" });
  const inD = new Date(check_in), outD = new Date(check_out);
  if (outD <= inD) return res.status(400).json({ error: "check_out must be after check_in" });
  const months = Math.max(1, Math.ceil((outD - inD) / (1000 * 60 * 60 * 24 * 30)));
  const total = flats[0].price * months;
  const id = uuid();
  await query(
    `INSERT INTO bookings (id, flat_id, tenant_id, owner_id, check_in, check_out, total_rent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, flat_id, req.user.id, flats[0].owner_id, check_in, check_out, total]
  );
  res.json({ id });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "confirmed", "cancelled"].includes(status)) return res.status(400).json({ error: "Bad status" });
  const rows = await query("SELECT tenant_id, owner_id FROM bookings WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const b = rows[0];
  const isParticipant = b.tenant_id === req.user.id || b.owner_id === req.user.id || req.user.role === "admin";
  if (!isParticipant) return res.status(403).json({ error: "Forbidden" });
  if (status === "confirmed" && b.owner_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Only owner can confirm" });
  await query("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ ok: true });
});

export default router;
