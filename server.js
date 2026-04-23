import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import authRouter from "./routes/auth.js";
import flatsRouter from "./routes/flats.js";
import bookingsRouter from "./routes/bookings.js";
import chatRouter from "./routes/chat.js";
import adminRouter from "./routes/admin.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api/flats", flatsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/admin", adminRouter);

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const server = http.createServer(app);

// WebSocket for real-time chat
const wss = new WebSocketServer({ server, path: "/ws" });
const channels = new Map(); // conversationId -> Set<ws>

global.wsBroadcast = (conversationId, payload) => {
  const set = channels.get(conversationId);
  if (!set) return;
  const data = JSON.stringify({ type: "message", conversationId, payload });
  for (const ws of set) if (ws.readyState === 1) ws.send(data);
};

wss.on("connection", (ws, req) => {
  // Auth via cookie
  const cookie = req.headers.cookie || "";
  const tok = /(?:^|;\s*)token=([^;]+)/.exec(cookie)?.[1];
  let userId = null;
  try { userId = jwt.verify(tok, process.env.JWT_SECRET || "dev_secret_change_me").id; }
  catch { ws.close(); return; }
  ws.userId = userId;
  ws.subs = new Set();

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "subscribe" && msg.conversationId) {
        if (!channels.has(msg.conversationId)) channels.set(msg.conversationId, new Set());
        channels.get(msg.conversationId).add(ws);
        ws.subs.add(msg.conversationId);
      }
    } catch {}
  });

  ws.on("close", () => {
    for (const c of ws.subs) channels.get(c)?.delete(ws);
  });
});

const PORT = Number(process.env.PORT || 3000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ FlatFinder running on port ${PORT}`);
});