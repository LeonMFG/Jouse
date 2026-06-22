# Deploying the BMP Tracker — handoff guide

This guide is for whoever puts the app online with the chapter's custom domain.
It's a small **Node.js** web app with its own **SQLite** database and **file uploads** — no
external database needed.

---

## ⚠️ The one thing that matters: persistent storage

The app keeps everything in two folders:

- `data/` — the SQLite database (`bmp.db`) with all accounts, progress, and approvals
- `uploads/` — the photo/PDF proof files brothers submit

The host **must give these a persistent disk** that survives restarts and redeploys.
Avoid "serverless"/ephemeral hosts (Vercel, Netlify, plain Heroku, Cloudflare Pages) — they
wipe the filesystem and you'd lose all data. Use a host with a **persistent volume** or a
normal **VPS** (see options below).

> In production, point the app at the mounted disk with two environment variables:
> `DATA_DIR` (database) and `UPLOAD_DIR` (uploads). The included Dockerfile already sets
> both to a single volume at `/data`.

---

## Step 1 — Send the project to your coworker

From the project folder, either:

**A) Zip it (excludes the big/regenerated folders):**
```bash
cd "/Users/noelleon/Desktop"
zip -r bmp-app.zip "BMP app" -x "*/node_modules/*" "*/data/*" "*/uploads/*" "*/.git/*"
```
Send `bmp-app.zip`.

**B) Or push it to GitHub** (better for updates later):
```bash
cd "/Users/noelleon/Desktop/BMP app"
git init && git add . && git commit -m "BMP Tracker"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/bmp-tracker.git
git push -u origin main
```
The included `.gitignore` keeps `node_modules/`, `data/`, and `uploads/` out of the repo.

---

## Step 2 — Pick a host (coworker does this)

You need **Node.js 18+** and a **persistent disk**. Three good options, easiest first:

### Option A — Railway / Render (managed, simplest)
1. Create a new project from the GitHub repo (or upload).
2. It auto-detects Node and runs `npm install` + `npm start`.
3. **Add a persistent volume/disk** and mount it at `/data` (Railway: "Volumes"; Render: "Disks").
4. Set environment variables (Step 3).
5. Add the custom domain in the dashboard (Step 4).

> Because of the included `Dockerfile`, Railway/Render/Fly can also just "deploy the Dockerfile,"
> which already wires `/data` for you — mount the volume at `/data` and you're done.

### Option B — Any VPS with Docker (DigitalOcean, Hetzner, Linode…)
```bash
# on the server, in the project folder:
docker build -t bmp-tracker .
docker run -d --name bmp \
  -p 3000:3000 \
  -e JWT_SECRET="<paste a long random string>" \
  -e NODE_ENV=production \
  -v /srv/bmp-data:/data \
  --restart unless-stopped \
  bmp-tracker
```
That stores the DB + uploads in `/srv/bmp-data` on the server (back this folder up).
Then put Nginx + HTTPS in front (Step 4).

### Option C — VPS without Docker (Node + PM2)
```bash
# install Node 18+ first, then:
cd /path/to/bmp-app
npm install
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # copy this
export JWT_SECRET="<the value you just copied>"
export NODE_ENV=production
npm run seed          # one time: loads requirements + demo accounts
npm install -g pm2
pm2 start server.js --name bmp
pm2 save && pm2 startup     # keeps it running after reboot
```

---

## Step 3 — Environment variables

Set these on the host (dashboard, or `-e` flags, or a `.env`). See `.env.example`.

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | **Required.** A long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` (enables HTTPS-only secure cookies) |
| `DATA_DIR` | Path to the persistent disk for the database (Docker sets `/data`) |
| `UPLOAD_DIR` | Path for uploads (Docker sets `/data/uploads`) |
| `PORT` | Usually set by the host automatically; defaults to 3000 |

---

## Step 4 — Point the custom domain at it & enable HTTPS

You already own the domain, so in your DNS provider:

- **Managed host (A):** the dashboard gives you a target (a CNAME hostname or an IP).
  Add the record it tells you (often a `CNAME` for `bmp.yourdomain.com`, or an `A` record for
  the root). The platform issues the HTTPS certificate automatically.

- **VPS (B/C):** create an **`A` record** pointing `bmp.yourdomain.com` → your server's IP,
  then run a reverse proxy with automatic HTTPS. Easiest is **Caddy**:
  ```
  # /etc/caddy/Caddyfile
  bmp.yourdomain.com {
      reverse_proxy localhost:3000
  }
  ```
  `sudo systemctl reload caddy` — Caddy fetches a free Let's Encrypt certificate automatically.
  (Nginx + Certbot works too if you prefer.)

> **HTTPS is required in production.** With `NODE_ENV=production` the login cookie is marked
> "secure," so logins only work over `https://`. Every option above gives you HTTPS — just make
> sure you visit the site with `https://`.

---

## Step 5 — First login & lock it down

1. The app seeds demo accounts on first run (see `README.md`), all with password `sigep123`.
2. Log in as the VPMD (`vpmd@fiusigep.com`), then use **Manage Roles** to set the real VPMD and
   coordinators.
3. **Change the default passwords.** Each account changes its own password in-app via the
   **Account** button (top-right) → *Change your password*. Have the VPMD and every coordinator
   do this right after first login. You can also rename the seed accounts in `bmp-data.js` and
   run `npm run reset` *before* real people sign up.
4. Real brothers then self-register and their coordinator approves them.

---

## Backups

Everything important is the **`data/` folder** (or your mounted volume, e.g. `/srv/bmp-data`).
Copy it somewhere safe on a schedule:
```bash
# example daily backup of the volume
tar czf bmp-backup-$(date +%F).tgz /srv/bmp-data
```

---

## Updating the app later
- **GitHub route:** push changes, then the host redeploys (or `git pull && npm install && pm2 restart bmp`).
- The database and uploads are untouched by updates as long as `DATA_DIR`/`UPLOAD_DIR` (or the
  mounted volume) stay the same.

Questions about the code itself → it's all plain Node + a no-build HTML/JS frontend; start with
`README.md`.
