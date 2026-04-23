import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "../utils/uuid.js";
import { query } from "../config/db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    if (password.length < 6) return res.status(400).json({ error: "Password too short" });
    const r = ["tenant", "owner"].includes(role) ? role : "tenant";

    const exists = await query("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (exists.length) return res.status(409).json({ error: "Email already registered" });

    const id = uuid();
    const hash = await bcrypt.hash(password, 12);
    await query(
      "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [id, name, email.toLowerCase(), hash, r]
    );
    const user = { id, name, email: email.toLowerCase(), role: r };
    const token = signToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 });
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });
    const rows = await query("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    const fake = "$2a$12$0000000000000000000000000000000000000000000000000000";
    const user = rows[0];
    const ok = await bcrypt.compare(password, user?.password || fake);
    if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
    const token = signToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
