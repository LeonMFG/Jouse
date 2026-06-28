import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production point DATA_DIR at a mounted persistent disk so the database survives redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'bmp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',   -- member | coordinator | admin
  tier          TEXT,                             -- sigma | phi | epsilon | NULL
  status        TEXT NOT NULL DEFAULT 'active',   -- pending | active  (members await coordinator approval)
  start_date    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requirements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tier        TEXT NOT NULL,                       -- sigma | phi | epsilon
  kind        TEXT NOT NULL,                       -- meeting | activity | checklist
  category    TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  mandatory   INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | denied
  reflection     TEXT,
  proof_path     TEXT,
  proof_name     TEXT,
  submitted_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by    INTEGER REFERENCES users(id),
  reviewed_at    TEXT,
  review_note    TEXT,
  UNIQUE(user_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS event_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open',    -- open | planned | declined
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_req_tier ON requirements(tier);
`);

// --- Migrations for databases created before a column existed ---------------
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('status')) {
  // Existing accounts predate approvals, so treat them as already active.
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
}

export default db;
