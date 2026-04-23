import { Router } from "express";
import { v4 as uuid } from "../utils/uuid.js";
import { query } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

/* ───────────────── SAFE AMENITIES PARSER ───────────────── */

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

/* ───────────────── PUBLIC FLATS ───────────────── */

router.get("/", async (req, res) => {
  try {
    const { type, area, minPrice, maxPrice, q } = req.query;

    const where = ["f.status = 'approved'"];
    const params = [];

    if (type) {
      where.push("f.type = ?");
      params.push(type);
    }

    if (area) {
      where.push("f.area = ?");
      params.push(area);
    }

    if (minPrice) {
      where.push("f.price >= ?");
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      where.push("f.price <= ?");
      params.push(Number(maxPrice));
    }

    if (q) {
      where.push("(f.title LIKE ? OR f.address LIKE ? OR f.area LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const rows = await query(
      `SELECT f.*, u.name AS owner_name
       FROM flats f
       JOIN users u ON u.id = f.owner_id
       WHERE ${where.join(" AND ")}
       ORDER BY f.created_at DESC`,
      params
    );

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

/* ───────────────── OWNER FLATS ───────────────── */

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      "SELECT * FROM flats WHERE owner_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );

    res.json({
      flats: rows.map(r => ({
        ...r,
        amenities: parseAmenities(r.amenities)
      }))
    });
  } catch (err) {
    console.error("GET MINE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user flats" });
  }
});

/* ───────────────── SINGLE FLAT ───────────────── */

router.get("/:id", async (req, res) => {
  try {
    const rows = await query(
      `SELECT f.*, u.name AS owner_name, u.email AS owner_email
       FROM flats f
       JOIN users u ON u.id = f.owner_id
       WHERE f.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Not found" });
    }

    const f = rows[0];

    res.json({
      flat: {
        ...f,
        amenities: parseAmenities(f.amenities)
      }
    });
  } catch (err) {
    console.error("GET FLAT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch flat" });
  }
});

/* ───────────────── CREATE FLAT ───────────────── */

router.post("/", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  try {
    const {
      title,
      type,
      area,
      address,
      price,
      description,
      amenities,
      image_url
    } = req.body || {};

    if (!title || !type || !area || !price) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const id = uuid();

    await query(
      `INSERT INTO flats
       (id, owner_id, title, type, area, address, price, description, amenities, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        title,
        type,
        area,
        address || null,
        Number(price),
        description || null,
        JSON.stringify(amenities || []),
        image_url || null
      ]
    );

    res.json({ id });
  } catch (err) {
    console.error("CREATE FLAT ERROR:", err);
    res.status(500).json({ error: "Failed to create flat" });
  }
});

/* ───────────────── DELETE FLAT ───────────────── */

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      "SELECT owner_id FROM flats WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Not found" });
    }

    if (rows[0].owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await query("DELETE FROM flats WHERE id = ?", [req.params.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE FLAT ERROR:", err);
    res.status(500).json({ error: "Failed to delete flat" });
  }
});

/* ───────────────── ADMIN REVIEW ───────────────── */

router.patch("/:id/review", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Bad status" });
    }

    await query(
      `UPDATE flats
       SET status = ?, reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ?`,
      [status, req.user.id, req.params.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("REVIEW ERROR:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;