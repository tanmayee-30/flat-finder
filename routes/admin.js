import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// 🔐 Admin protection
router.use(requireAuth, requireRole("admin"));

/* ───────────────── USERS ───────────────── */

router.get("/users", async (_req, res) => {
  try {
    const rows = await query(`
      SELECT id, name, email, role, status, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({ users: rows });
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const { status, role } = req.body || {};

    const fields = [];
    const params = [];

    if (status && ["active", "suspended"].includes(status)) {
      fields.push("status = ?");
      params.push(status);
    }

    if (role && ["tenant", "owner", "admin"].includes(role)) {
      fields.push("role = ?");
      params.push(role);
    }

    if (!fields.length) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    params.push(req.params.id);

    await query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ───────────────── FLATS ───────────────── */

const parseAmenities = (a) => {
  try {
    if (!a) return [];
    if (Array.isArray(a)) return a;

    return JSON.parse(a);
  } catch {
    return typeof a === "string"
      ? a.split(",").map(x => x.trim()).filter(Boolean)
      : [];
  }
};

router.get("/flats", async (_req, res) => {
  try {
    const rows = await query(`
      SELECT f.*, u.name AS owner_name
      FROM flats f
      JOIN users u ON u.id = f.owner_id
      ORDER BY f.created_at DESC
    `);

    res.json({
      flats: rows.map(r => ({
        ...r,
        amenities: parseAmenities(r.amenities)
      }))
    });
  } catch (err) {
    console.error("GET FLATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch flats" });
  }
});

export default router;