# 🏠 FlatFinder

A full-stack rental flat platform for Pune — Node.js + Express + MySQL.
Tenants browse and book flats, owners list properties (admin-approved), and everyone can chat in real time.

---

## ✨ Features

- **3 user roles** — tenant, owner, admin
- **Auth** — secure JWT in httpOnly cookies, bcrypt password hashing
- **Listings** — owners post flats; admin approves before they go public
- **Filters** — by type (1BHK/2BHK/3BHK/Studio/Rooms), area (Pune localities), budget range, free-text search
- **Bookings** — tenants book approved flats; owners confirm
- **Real-time chat** — private 1-to-1 messaging via WebSockets (no polling)
- **Admin dashboard** — approve listings, suspend users

---

## 📁 Structure

```
flatfinder/
├── server.js               Main Express server + WebSocket
├── schema.sql              MySQL schema
├── package.json
├── .env.example
├── config/
│   └── db.js               MySQL connection pool
├── middleware/
│   └── auth.js             JWT auth + role guards
├── routes/
│   ├── auth.js             /api/signup /api/login /api/logout /api/me
│   ├── flats.js            /api/flats CRUD + admin review
│   ├── bookings.js         /api/bookings CRUD
│   ├── chat.js             /api/chat conversations + messages
│   └── admin.js            /api/admin users + flats
├── scripts/
│   └── init-db.js          One-shot DB setup + seed admin
├── utils/
│   └── uuid.js
└── public/                 Vanilla JS SPA
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

---

## 🚀 Local Setup (Step-by-Step)

### 1. Install prerequisites
- **Node.js 18+** — https://nodejs.org
- **MySQL 8+** — https://dev.mysql.com/downloads/mysql/  (or MariaDB 10.5+)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your MySQL credentials and a strong `JWT_SECRET`.

### 4. Initialize the database
This creates all tables AND seeds an admin login:
```bash
npm run init-db
```
Default admin: **admin@flatfinder.local** / **admin123** — change immediately.

### 5. Start the server
```bash
npm start
# or with auto-reload:
npm run dev
```

### 6. Open
http://localhost:3000

---

## 🌐 Deployment Options

### Option A — Render.com (easiest, free tier available)

1. Push your code to a GitHub repo.
2. Sign up at https://render.com.
3. **Create a MySQL database**:
   - Render does not host MySQL natively. Use **Railway** (https://railway.app) or **PlanetScale** (https://planetscale.com) for free MySQL.
   - Copy the host / user / password / database name from there.
4. **Create a Web Service** on Render → "New → Web Service":
   - Connect your repo
   - Build command: `npm install`
   - Start command: `npm start`
5. **Environment Variables** (in Render dashboard):
   ```
   DB_HOST=<from Railway/PlanetScale>
   DB_PORT=3306
   DB_USER=<...>
   DB_PASSWORD=<...>
   DB_NAME=flatfinder
   JWT_SECRET=<long random string>
   FRONTEND_ORIGIN=https://your-app.onrender.com
   NODE_ENV=production
   ```
6. **Run schema once**: open Railway/PlanetScale console and paste `schema.sql`, then INSERT one admin user (or temporarily SSH and run `npm run init-db`).
7. Click Deploy. Done.

### Option B — Railway.app (single platform, easiest for MySQL)

1. Sign up at https://railway.app and connect GitHub.
2. **New Project → Deploy from GitHub**.
3. **Add a MySQL plugin** to the same project.
4. In your service → Variables, click "Reference" to import the MySQL vars (Railway auto-fills `MYSQLHOST`, `MYSQLUSER`, etc.) — rename them to match the names in `.env.example` (`DB_HOST`, etc.) or update `config/db.js`.
5. Add `JWT_SECRET` and `NODE_ENV=production`.
6. Set start command (in `Settings → Deploy`): `npm start`.
7. Open the MySQL plugin → "Data" tab → paste `schema.sql`.
8. Insert admin user manually or SSH into the service and run `npm run init-db`.
9. Generate a public domain in Settings → Networking. Done.

### Option C — VPS (DigitalOcean, AWS EC2, Hostinger VPS, etc.)

1. SSH into your server.
2. Install Node 18+ and MySQL:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs mysql-server git
   sudo mysql_secure_installation
   ```
3. Clone your project and install:
   ```bash
   git clone <your-repo> flatfinder && cd flatfinder
   npm install
   cp .env.example .env && nano .env   # fill in values
   npm run init-db
   ```
4. Run with **PM2** for process management:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name flatfinder
   pm2 startup && pm2 save
   ```
5. Put **Nginx** in front for HTTPS:
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
     }
   }
   ```
6. Get a free SSL cert: `sudo certbot --nginx -d your-domain.com`. Done.

### Option D — Docker (anywhere)

Create a `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```
And run with `docker build -t flatfinder . && docker run -p 3000:3000 --env-file .env flatfinder`. Pair with a managed MySQL (PlanetScale, AWS RDS, etc.).

---

## 🔒 Security Notes

- Change the seeded admin password immediately after first login.
- Always set a strong `JWT_SECRET` (32+ random chars) in production.
- Use HTTPS in production (cookies are sent via `sameSite: lax`).
- The provided `helmet()` adds standard HTTP security headers.

---

## 🐛 Common Issues

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on startup | MySQL not running, or wrong host/port in `.env` |
| `Access denied for user` | Wrong DB user/password — verify with `mysql -u USER -p` |
| Login works but `/api/me` says "Not authenticated" | You're opening the file directly. Open `http://localhost:3000` instead. |
| WebSocket disconnects on Render/Railway | They support WS by default — make sure your reverse proxy (Nginx) has the `Upgrade`/`Connection` headers shown above. |
| CORS errors | Set `FRONTEND_ORIGIN` in `.env` to your real domain |

---

## 📦 API Reference

### Auth
- `POST /api/signup` — `{ name, email, password, role: "tenant"|"owner" }`
- `POST /api/login` — `{ email, password }`
- `POST /api/logout`
- `GET  /api/me`

### Flats
- `GET    /api/flats?type=&area=&minPrice=&maxPrice=&q=` — public, approved only
- `GET    /api/flats/mine` — auth, owner's own listings (any status)
- `GET    /api/flats/:id` — public
- `POST   /api/flats` — owner/admin
- `DELETE /api/flats/:id` — owner of flat or admin
- `PATCH  /api/flats/:id/review` — admin, `{ status: "approved"|"rejected" }`

### Bookings
- `GET   /api/bookings` — auth (tenant/owner sees own; admin sees all)
- `POST  /api/bookings` — auth, `{ flat_id, check_in, check_out }`
- `PATCH /api/bookings/:id` — `{ status }`

### Chat
- `GET  /api/chat/conversations`
- `POST /api/chat/conversations` — `{ flat_id }`
- `GET  /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/messages` — `{ content }`
- `WS   /ws` — subscribe with `{ type: "subscribe", conversationId }`

### Admin (admin role only)
- `GET    /api/admin/users`
- `PATCH  /api/admin/users/:id` — `{ status?, role? }`
- `DELETE /api/admin/users/:id`
- `GET    /api/admin/flats`

---

## 📄 License
MIT — do whatever you want.
