# Deploying to Railway — exact steps

This app is already Railway-ready: it includes a `Dockerfile` that sets `NODE_ENV=production`,
stores all data under `/data`, and seeds the database on first boot. Follow these steps.

> ⚠️ The single most important step is **#4 — add a Volume mounted at `/data`**. Without it,
> the database and uploaded files are wiped on every redeploy.

## 1. Get the code onto GitHub
Railway deploys from a GitHub repo. Easiest:
- Create a new empty repo on github.com (e.g. `bmp-tracker`).
- Upload the project files to it (GitHub's "uploading an existing file" works, or `git push`).
  Don't include `node_modules`, `data`, or `uploads` — the included `.gitignore` already skips them.

## 2. Create the Railway project
- Railway → **New Project → Deploy from GitHub repo** → pick the repo.
- Railway detects the `Dockerfile` and builds automatically.

## 3. Set environment variables
In the service → **Variables**, add:
- `JWT_SECRET` = a long random string. (Generate one anywhere, e.g. run in a terminal:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `NODE_ENV` = `production` (the Dockerfile sets this too, but setting it explicitly is fine)

You do **not** need to set `PORT` — Railway provides it and the app uses it automatically.

## 4. Add a persistent Volume  ← don't skip
- Service → **Settings → Volumes → New Volume**.
- **Mount path: `/data`**
- This is where `bmp.db` and the `uploads/` folder live. Back it up periodically.

## 5. Deploy & open it
- Railway builds and starts it. The logs should show the seed run, then
  `FIU SigEp BMP Tracker running...`.
- Open the temporary `*.up.railway.app` URL to confirm it loads.

## 6. Add your custom domain
- Service → **Settings → Networking → Custom Domain** → enter `bmp.yourdomain.com`.
- Railway shows a **CNAME target**. Add that CNAME record at your DNS provider.
- Railway issues HTTPS automatically. Visit the site over `https://`.

## 7. First login & lock it down
- Sign in as the VPMD: `vpmd@fiusigep.com` / `sigep123`.
- **Manage Roles** → set the real VPMD and coordinators.
- Everyone changes their password via the **Account** button (top-right). Coordinators/admin can
  also reset a member's password from the member's page / Manage Roles.

That's it. See `DEPLOY.md` for non-Railway options and `README.md` for how the app works.
