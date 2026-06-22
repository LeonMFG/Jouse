# FIU SigEp — Balanced Man Program Tracker

A web app for the **Florida Nu** chapter to track the **Sigma**, **Phi**, and **Epsilon**
challenges of SigEp's Balanced Man Program. Brothers see their required meetings and
activities, submit completed items with a written reflection and photo/PDF proof, and
each tier's **Coordinator** reviews and approves them — with a live progress view for
every member.

All challenge requirements are seeded directly from the official FIU SigEp Sigma, Phi,
and Epsilon Challenge documents.

---

## What it does

**For brothers (members)**
- See your challenge's meetings + activities grouped by category (Sound Mind, Sound Body, etc.)
- Live progress: meetings attended, activities approved, per-category minimums, mandatory items
- Submit a completed item with a 2–3 sentence reflection + an optional photo/PDF as proof
- See approval status and any note your coordinator left; resubmit items that were sent back
- Change your own password anytime via the **Account** button (top-right)

**For coordinators (one per tier) & the VPMD (admin)**
- **Review Queue** — approve or send back every submission from your group, with an optional note
- **My Members** — roster of everyone in your challenge with progress bars and pending counts
- **Pending** — approve (or decline) brothers who just signed up before they join your roster
- **Member detail** — open any brother to approve items *or mark anything done directly*
  (e.g. taking meeting attendance), and reset items if needed
- **Manage Roles** *(admin/VPMD only)* — promote any brother to a coordinator or change their challenge
- **Reset a password** — a coordinator can reset any of their members' passwords (from the member's
  page); the admin can reset anyone's (from Manage Roles). It generates a one-time temporary
  password to hand over; the person then sets their own via the Account button.
- A **Phi** coordinator only sees Phi members; **Sigma**/**Epsilon** the same. The **VPMD/admin**
  sees all three tiers.

## How people get accounts

- **Brothers** sign up themselves with the **Create an account** link, entering their name,
  email, password, and challenge (Sigma / Phi / Epsilon). New sign-ups start as **pending** —
  they see a "waiting for approval" screen until their tier **coordinator approves them** from
  the **Pending** tab. This keeps random sign-ups out of the roster.
- **Coordinators & the VPMD** are not self-serve. The **VPMD/admin** sets every role from the
  **Manage Roles** screen — no code editing needed:
  - **Promote a brother to Coordinator** (and pick their challenge). A coordinator is a
    "mini-admin" for just their own subgroup: they approve join requests, review/approve
    challenge submissions, and take attendance — but only for their tier.
  - **Grant Admin (VPMD) access** to anyone via the role dropdown → *Admin (VPMD)*. Admins
    have full chapter-wide access across all three challenges.
  - **Hand off the VPMD:** promote your successor to Admin first, then change your own row down
    to Coordinator/Member. The app refuses to remove the *last* admin, so the chapter can never
    be locked out. There can be more than one admin at a time if you want co-VPMDs.

  The four starting staff accounts below are pre-seeded from your challenge documents.

---

## Run it

Requires [Node.js](https://nodejs.org) 18+ (built and tested on Node 24).

```bash
cd "BMP app"
npm install      # already done if you see a node_modules/ folder
npm run seed     # creates the database + loads all challenge requirements & demo accounts
npm start        # starts the server
```

Then open **http://localhost:3000**.

> `npm run seed` is safe to run repeatedly — it won't duplicate data.
> To wipe everything and start clean: `npm run reset`.

---

## Demo accounts

All use the password **`sigep123`** (change them after first login by re-seeding).

| Role | Email | Sees |
|------|-------|------|
| VPMD / Admin | `vpmd@fiusigep.com` | All three challenges |
| Sigma Coordinator | `sigma.coordinator@fiusigep.com` | Sigma members |
| Phi Coordinator | `phi.coordinator@fiusigep.com` | Phi members |
| Epsilon Coordinator | `epsilon.coordinator@fiusigep.com` | Epsilon members |
| Member (Phi) | `brother@fiusigep.com` | Their own challenge |

New brothers create their own account from the **Create an account** link and pick their
challenge (Sigma / Phi / Epsilon).

---

## Challenge rules built in

| Challenge | Meetings | Activities |
|-----------|----------|------------|
| **Sigma** (6–8 wks) | Attend all weekly meetings | Complete the full checklist |
| **Phi** (24–52 wks) | Attend 5 of 6 | Complete 20, min. 3 per category, all mandatory items |
| **Epsilon** (12–18 mo) | Attend 5 of 7 | Complete 20, min. 3 per category, all mandatory items |

A member is marked **complete** only when meetings, the activity target, every category
minimum, and all mandatory items are satisfied.

---

## How it's built

- **Backend:** Node + Express, **SQLite** (`better-sqlite3`) — a single file at `data/bmp.db`, no DB server to run
- **Auth:** signed JWT in an httpOnly cookie; passwords hashed with bcrypt; role + tier scoping on every endpoint
- **Uploads:** photo/PDF proof via `multer`, stored in `uploads/` and served only to the owner or their coordinator
- **Frontend:** a single-page app in plain HTML/CSS/JS (`public/`) — no build step

```
BMP app/
├─ server.js        Express API + static hosting + protected file serving
├─ db.js            SQLite connection + schema
├─ bmp-data.js      All Sigma/Phi/Epsilon requirements + tier rules + demo users
├─ seed.js          Loads requirements & demo accounts (npm run seed / reset)
├─ public/          index.html · styles.css · app.js  (the web app)
├─ data/            bmp.db  (created on first run — gitignored)
└─ uploads/         proof files (created on first run — gitignored)
```

### Editing the requirements
The meetings and activities live in `bmp-data.js`. Edit the lists there, then run
`npm run reset && npm run seed` to reload them. (Meetings change per semester — e.g. the
Spring 2026 Phi meetings — so a coordinator can swap titles there.)

---

## Notes & next steps
- Runs locally on one machine today. To let brothers use it from their own phones, host it
  on any Node host (Render, Railway, Fly.io, a small VPS) and set a real `JWT_SECRET`
  environment variable.
- Possible additions: email notifications on approval, CSV export of the roster, scheduled
  meeting dates with RSVP, and a coordinator screen to edit a semester's meeting list from
  the UI instead of `bmp-data.js`.
