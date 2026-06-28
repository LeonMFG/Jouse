import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { TIERS } from './bmp-data.js';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'fiu-sigep-bmp-dev-secret-change-me';
const TOKEN_COOKIE = 'bmp_token';

if (PROD && JWT_SECRET === 'fiu-sigep-bmp-dev-secret-change-me') {
  console.warn('\n  ⚠  Running in production with the default JWT_SECRET. Set a strong JWT_SECRET environment variable!\n');
}

// Uploads can live on a mounted persistent disk in production (set UPLOAD_DIR).
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1); // behind a reverse proxy / platform load balancer (for secure cookies + HTTPS detection)
app.use(express.json());
app.use(cookieParser());

// --- File uploads (photo / document proof) --------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|gif|webp|heic)|application\/pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Only images or PDF files are allowed.'), ok);
  },
});

// --- Auth helpers ----------------------------------------------------------
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, tier: user.tier }, JWT_SECRET, { expiresIn: '30d' });
}
function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: PROD,            // require HTTPS for the cookie in production
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
function getUserById(id) {
  return db.prepare('SELECT id, name, email, role, tier, status, start_date, created_at FROM users WHERE id = ?').get(id);
}
function authRequired(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
function staffRequired(req, res, next) {
  if (req.user.role !== 'coordinator' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Coordinator access required.' });
  next();
}
function adminRequired(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin (VPMD) access required.' });
  next();
}
// A member must be approved by their coordinator before submitting work.
function approvedMember(req, res, next) {
  if (req.user.role === 'member' && req.user.status === 'pending')
    return res.status(403).json({ error: 'Your account is waiting for coordinator approval.' });
  next();
}
// Which tiers a staff member may review/manage.
function tiersFor(user) {
  if (user.role === 'admin') return ['sigma', 'phi', 'epsilon'];
  if (user.role === 'coordinator') return user.tier ? [user.tier] : [];
  return [];
}

// ===========================================================================
// AUTH
// ===========================================================================
app.post('/api/auth/register', (req, res) => {
  const { name, username, password, tier } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username, and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!TIERS[tier]) return res.status(400).json({ error: 'Please choose a valid challenge (Sigma, Phi, or Epsilon).' });

  const uname = String(username).toLowerCase().trim();
  if (!uname) return res.status(400).json({ error: 'Please choose a username.' });
  const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(uname);
  if (existing) return res.status(409).json({ error: 'That username is already taken.' });

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, tier, status, start_date)
    VALUES (?, ?, ?, 'member', ?, 'pending', date('now'))
  `).run(name.trim(), uname, bcrypt.hashSync(password, 10), tier);

  const user = getUserById(info.lastInsertRowid);
  setAuthCookie(res, signToken(user));
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(username).toLowerCase().trim());
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    return res.status(401).json({ error: 'Incorrect username or password.' });
  const user = getUserById(row.id);
  setAuthCookie(res, signToken(user));
  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user, tiers: TIERS });
});

// Any signed-in user can change their own password.
app.post('/api/auth/change-password', authRequired, (req, res) => {
  const current = req.body.currentPassword || '';
  const next = req.body.newPassword || '';
  if (next.length < 6) return res.status(400).json({ error: 'Your new password must be at least 6 characters.' });
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, row.password_hash))
    return res.status(401).json({ error: 'Your current password is incorrect.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  // Re-issue the session token so the login cookie stays valid.
  setAuthCookie(res, signToken(req.user));
  res.json({ ok: true });
});

// ===========================================================================
// REQUIREMENTS + a member's own progress
// ===========================================================================
function requirementsForTier(tier) {
  return db.prepare('SELECT * FROM requirements WHERE tier = ? AND active = 1 ORDER BY kind, sort_order').all(tier);
}

// Member's dashboard: every requirement for their tier + their submission status.
app.get('/api/my/progress', authRequired, (req, res) => {
  const tier = req.user.tier;
  if (!tier) return res.json({ tier: null, items: [], rules: null });
  const reqs = requirementsForTier(tier);
  const subs = db.prepare('SELECT * FROM submissions WHERE user_id = ?').all(req.user.id);
  const byReq = new Map(subs.map((s) => [s.requirement_id, s]));
  const items = reqs.map((r) => ({ ...r, submission: byReq.get(r.id) || null }));
  res.json({ tier, rules: TIERS[tier].rules, tierInfo: TIERS[tier], items });
});

// Member submits / updates a submission for a requirement (with optional proof).
app.post('/api/my/submissions', authRequired, approvedMember, upload.single('proof'), (req, res) => {
  const requirementId = Number(req.body.requirement_id);
  const reflection = (req.body.reflection || '').trim();
  const req0 = db.prepare('SELECT * FROM requirements WHERE id = ?').get(requirementId);
  if (!req0) return res.status(404).json({ error: 'Requirement not found.' });
  if (req0.tier !== req.user.tier) return res.status(403).json({ error: 'That requirement is not part of your challenge.' });
  if (!reflection || reflection.length < 10)
    return res.status(400).json({ error: 'Please write a short reflection (a couple of sentences) about what you did.' });

  const proofPath = req.file ? `/uploads/${req.file.filename}` : null;
  const proofName = req.file ? req.file.originalname : null;

  const existing = db.prepare('SELECT * FROM submissions WHERE user_id = ? AND requirement_id = ?')
    .get(req.user.id, requirementId);

  if (existing) {
    // Re-submitting resets it to pending for re-review. Keep old proof if no new file.
    db.prepare(`
      UPDATE submissions
      SET status='pending', reflection=?, proof_path=COALESCE(?, proof_path),
          proof_name=COALESCE(?, proof_name), submitted_at=datetime('now'),
          reviewed_by=NULL, reviewed_at=NULL, review_note=NULL
      WHERE id=?
    `).run(reflection, proofPath, proofName, existing.id);
    return res.json({ submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(existing.id) });
  }

  const info = db.prepare(`
    INSERT INTO submissions (user_id, requirement_id, status, reflection, proof_path, proof_name)
    VALUES (?, ?, 'pending', ?, ?, ?)
  `).run(req.user.id, requirementId, reflection, proofPath, proofName);
  res.json({ submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(info.lastInsertRowid) });
});

// Member withdraws a not-yet-approved submission.
app.delete('/api/my/submissions/:id', authRequired, (req, res) => {
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  db.prepare('DELETE FROM submissions WHERE id = ?').run(sub.id);
  res.json({ ok: true });
});

// ===========================================================================
// COORDINATOR / ADMIN
// ===========================================================================

// Compute a progress summary for a member.
function summarize(userId, tier) {
  const rules = TIERS[tier].rules;
  const reqs = requirementsForTier(tier);
  const subs = db.prepare("SELECT * FROM submissions WHERE user_id = ?").all(userId);
  const approved = new Set(subs.filter((s) => s.status === 'approved').map((s) => s.requirement_id));
  const pending = subs.filter((s) => s.status === 'pending').length;

  const meetings = reqs.filter((r) => r.kind === 'meeting');
  const activities = reqs.filter((r) => r.kind !== 'meeting');
  const meetingsDone = meetings.filter((r) => approved.has(r.id)).length;
  const activitiesDone = activities.filter((r) => approved.has(r.id)).length;

  // per-category counts (activities only)
  const perCategory = {};
  for (const r of activities) {
    perCategory[r.category] ??= { total: 0, done: 0 };
    perCategory[r.category].total++;
    if (approved.has(r.id)) perCategory[r.category].done++;
  }
  const mandatoryItems = activities.filter((r) => r.mandatory);
  const mandatoryDone = mandatoryItems.filter((r) => approved.has(r.id)).length;

  const activitiesTarget = rules.activitiesMode === 'all' ? activities.length : rules.activitiesRequired;
  const meetingsOk = meetingsDone >= rules.meetingsRequired;
  const minCatOk = rules.minPerCategory === 0 ||
    Object.values(perCategory).filter((c) => c.done >= rules.minPerCategory).length >=
      Object.keys(perCategory).length;
  const activitiesOk = activitiesDone >= activitiesTarget && minCatOk && mandatoryDone === mandatoryItems.length;
  const complete = meetingsOk && activitiesOk;

  return {
    meetings: { done: meetingsDone, required: rules.meetingsRequired, total: meetings.length },
    activities: { done: activitiesDone, target: activitiesTarget, total: activities.length, minPerCategory: rules.minPerCategory },
    perCategory,
    mandatory: { done: mandatoryDone, total: mandatoryItems.length },
    pending,
    complete,
  };
}

// Roster of members in the tiers this staffer manages.
app.get('/api/staff/members', authRequired, staffRequired, (req, res) => {
  const tiers = tiersFor(req.user);
  if (tiers.length === 0) return res.json({ members: [] });
  const placeholders = tiers.map(() => '?').join(',');
  const members = db.prepare(
    `SELECT id, name, email, tier, start_date, created_at FROM users WHERE role='member' AND status='active' AND tier IN (${placeholders}) ORDER BY name`
  ).all(...tiers);
  const withProgress = members.map((m) => ({ ...m, summary: summarize(m.id, m.tier) }));
  const pendingCount = db.prepare(
    `SELECT COUNT(*) c FROM users WHERE role='member' AND status='pending' AND tier IN (${placeholders})`
  ).get(...tiers).c;
  res.json({ members: withProgress, tiers, pendingCount });
});

// Members awaiting approval in the tiers this staffer manages.
app.get('/api/staff/pending', authRequired, staffRequired, (req, res) => {
  const tiers = tiersFor(req.user);
  if (tiers.length === 0) return res.json({ pending: [] });
  const placeholders = tiers.map(() => '?').join(',');
  const pending = db.prepare(
    `SELECT id, name, email, tier, created_at FROM users
     WHERE role='member' AND status='pending' AND tier IN (${placeholders}) ORDER BY created_at`
  ).all(...tiers);
  res.json({ pending });
});

// Approve a pending member into the roster.
app.post('/api/staff/members/:id/approve', authRequired, staffRequired, (req, res) => {
  const m = db.prepare("SELECT id, tier, status FROM users WHERE id=? AND role='member'").get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Member not found.' });
  if (!tiersFor(req.user).includes(m.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  db.prepare("UPDATE users SET status='active' WHERE id=?").run(m.id);
  res.json({ ok: true });
});

// Generate a short, readable one-time password to hand to a brother.
function genTempPassword() {
  return 'BMP-' + crypto.randomBytes(3).toString('hex'); // e.g. BMP-a3f9c1
}

// Coordinator/admin resets a member's password (members in their own tier).
app.post('/api/staff/members/:id/reset-password', authRequired, staffRequired, (req, res) => {
  const m = db.prepare("SELECT id, name, tier FROM users WHERE id=? AND role='member'").get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Member not found.' });
  if (!tiersFor(req.user).includes(m.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  const tempPassword = genTempPassword();
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(tempPassword, 10), m.id);
  res.json({ tempPassword, name: m.name });
});

// Decline a pending member (removes the account).
app.post('/api/staff/members/:id/decline', authRequired, staffRequired, (req, res) => {
  const m = db.prepare("SELECT id, tier, status FROM users WHERE id=? AND role='member'").get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Member not found.' });
  if (!tiersFor(req.user).includes(m.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  if (m.status !== 'pending') return res.status(400).json({ error: 'That member is already approved.' });
  db.prepare('DELETE FROM users WHERE id=?').run(m.id);
  res.json({ ok: true });
});

// Pending review queue across the tiers this staffer manages.
app.get('/api/staff/queue', authRequired, staffRequired, (req, res) => {
  const tiers = tiersFor(req.user);
  if (tiers.length === 0) return res.json({ submissions: [] });
  const placeholders = tiers.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT s.*, u.name AS member_name, u.tier AS member_tier,
           r.title AS req_title, r.kind AS req_kind, r.category AS req_category, r.mandatory
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN requirements r ON r.id = s.requirement_id
    WHERE s.status = 'pending' AND u.tier IN (${placeholders})
    ORDER BY s.submitted_at ASC
  `).all(...tiers);
  const pendingCount = db.prepare(
    `SELECT COUNT(*) c FROM users WHERE role='member' AND status='pending' AND tier IN (${placeholders})`
  ).get(...tiers).c;
  res.json({ submissions: rows, pendingCount });
});

// Full detail for one member (staff view).
app.get('/api/staff/members/:id', authRequired, staffRequired, (req, res) => {
  const member = db.prepare("SELECT id, name, email, tier, start_date FROM users WHERE id = ? AND role='member'").get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (!tiersFor(req.user).includes(member.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  const reqs = requirementsForTier(member.tier);
  const subs = db.prepare('SELECT * FROM submissions WHERE user_id = ?').all(member.id);
  const byReq = new Map(subs.map((s) => [s.requirement_id, s]));
  const items = reqs.map((r) => ({ ...r, submission: byReq.get(r.id) || null }));
  res.json({ member, items, summary: summarize(member.id, member.tier), tierInfo: TIERS[member.tier] });
});

// Approve / deny a submission.
app.post('/api/staff/submissions/:id/review', authRequired, staffRequired, (req, res) => {
  const decision = req.body.decision; // 'approved' | 'denied'
  const note = (req.body.note || '').trim() || null;
  if (!['approved', 'denied'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' });
  const sub = db.prepare(`
    SELECT s.*, u.tier AS member_tier FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?
  `).get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (!tiersFor(req.user).includes(sub.member_tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  db.prepare(`
    UPDATE submissions SET status=?, review_note=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?
  `).run(decision, note, req.user.id, sub.id);
  res.json({ submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(sub.id) });
});

// Coordinator can directly mark a member's requirement complete (e.g. meeting attendance)
// without the member submitting — useful for taking attendance.
app.post('/api/staff/mark', authRequired, staffRequired, (req, res) => {
  const userId = Number(req.body.user_id);
  const requirementId = Number(req.body.requirement_id);
  const member = db.prepare("SELECT id, tier FROM users WHERE id = ? AND role='member'").get(userId);
  const r0 = db.prepare('SELECT * FROM requirements WHERE id = ?').get(requirementId);
  if (!member || !r0) return res.status(404).json({ error: 'Member or requirement not found.' });
  if (!tiersFor(req.user).includes(member.tier) || r0.tier !== member.tier)
    return res.status(403).json({ error: 'Not in your challenge group.' });

  const existing = db.prepare('SELECT * FROM submissions WHERE user_id=? AND requirement_id=?').get(userId, requirementId);
  if (existing) {
    db.prepare(`UPDATE submissions SET status='approved', reviewed_by=?, reviewed_at=datetime('now'),
                review_note=COALESCE(review_note,'Marked by coordinator') WHERE id=?`).run(req.user.id, existing.id);
  } else {
    db.prepare(`INSERT INTO submissions (user_id, requirement_id, status, reflection, reviewed_by, reviewed_at, review_note)
                VALUES (?, ?, 'approved', 'Marked complete by coordinator.', ?, datetime('now'), 'Marked by coordinator')`)
      .run(userId, requirementId, req.user.id);
  }
  res.json({ ok: true });
});

// Unmark / reset a member's requirement (remove the submission).
app.post('/api/staff/unmark', authRequired, staffRequired, (req, res) => {
  const userId = Number(req.body.user_id);
  const requirementId = Number(req.body.requirement_id);
  const member = db.prepare("SELECT tier FROM users WHERE id = ?").get(userId);
  if (!member || !tiersFor(req.user).includes(member.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  db.prepare('DELETE FROM submissions WHERE user_id=? AND requirement_id=?').run(userId, requirementId);
  res.json({ ok: true });
});

// ===========================================================================
// ADMIN (VPMD) — manage roles
// ===========================================================================
app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const users = db.prepare(
    "SELECT id, name, email, role, tier, status FROM users ORDER BY role='admin' DESC, role='coordinator' DESC, name"
  ).all();
  res.json({ users });
});

app.post('/api/admin/users/:id/role', authRequired, adminRequired, (req, res) => {
  const role = req.body.role;       // member | coordinator | admin
  let tier = req.body.tier || null; // sigma | phi | epsilon | null
  if (!['member', 'coordinator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (role === 'admin') tier = null;
  if ((role === 'member' || role === 'coordinator') && !TIERS[tier])
    return res.status(400).json({ error: 'Please choose a challenge (Sigma, Phi, or Epsilon) for that role.' });

  const target = db.prepare('SELECT id, role FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  // Never allow the chapter to be left with zero VPMDs/admins.
  if (target.role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c;
    if (admins <= 1) return res.status(400).json({ error: 'There must always be at least one VPMD (admin). Promote someone else to admin first, then step down.' });
  }

  // Promotions become active immediately (no self-approval limbo for staff).
  db.prepare("UPDATE users SET role=?, tier=?, status='active' WHERE id=?").run(role, tier, target.id);
  res.json({ user: getUserById(target.id), self: target.id === req.user.id });
});

// Admin resets ANY user's password (members or coordinators).
app.post('/api/admin/users/:id/reset-password', authRequired, adminRequired, (req, res) => {
  const u = db.prepare('SELECT id, name FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Use the Account button to change your own password.' });
  const tempPassword = genTempPassword();
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(tempPassword, 10), u.id);
  res.json({ tempPassword, name: u.name });
});

// ===========================================================================
// Excel export of a member's progress
// ===========================================================================
function statusLabel(kind, status) {
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'Pending review';
  if (status === 'denied') return 'Needs redo';
  return kind === 'meeting' ? 'Not attended' : 'Not started';
}

async function buildMemberWorkbook(member) {
  const info = TIERS[member.tier] || { name: member.tier, rules: {} };
  const reqs = requirementsForTier(member.tier);
  const subs = db.prepare('SELECT * FROM submissions WHERE user_id = ?').all(member.id);
  const byReq = new Map(subs.map((s) => [s.requirement_id, s]));
  const summary = summarize(member.id, member.tier);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FIU SigEp BMP Tracker';
  wb.created = new Date();
  const ws = wb.addWorksheet('Progress');
  ws.columns = [
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Type', key: 'kind', width: 12 },
    { header: 'Item', key: 'title', width: 60 },
    { header: 'Mandatory', key: 'mandatory', width: 11 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Reflection', key: 'reflection', width: 50 },
    { header: 'Coordinator note', key: 'note', width: 30 },
    { header: 'Submitted', key: 'submitted', width: 14 },
    { header: 'Reviewed', key: 'reviewed', width: 14 },
  ];

  // Insert a title + summary block above the table header (which is row 1).
  ws.spliceRows(1, 0,
    ['Balanced Man Program — ' + (info.name || member.tier) + ' Progress'],
    ['Brother: ' + member.name],
    ['Username: ' + member.email],
    ['Challenge: ' + (info.name || member.tier)],
    ['Exported: ' + new Date().toLocaleString()],
    ['Meetings ' + summary.meetings.done + '/' + summary.meetings.required +
     '    Activities ' + summary.activities.done + '/' + summary.activities.target +
     '    Mandatory ' + summary.mandatory.done + '/' + summary.mandatory.total +
     '    Complete: ' + (summary.complete ? 'YES' : 'No')],
    [],
  );
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(6).font = { bold: true };
  const headerRow = ws.getRow(8); // table header after the inserted block
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B1D2B' } };

  const fmtDate = (val) => {
    if (!val) return '';
    const str = String(val);
    const d = new Date(str.replace(' ', 'T') + (str.includes('T') ? '' : 'Z'));
    return isNaN(d) ? str : d.toLocaleDateString();
  };

  reqs.forEach((r) => {
    const sub = byReq.get(r.id) || null;
    const status = sub ? sub.status : 'todo';
    ws.addRow({
      category: r.category || '',
      kind: r.kind === 'meeting' ? 'Meeting' : 'Activity',
      title: r.title,
      mandatory: r.mandatory ? 'Yes' : '',
      status: statusLabel(r.kind, status),
      reflection: sub && sub.reflection ? sub.reflection : '',
      note: sub && sub.review_note ? sub.review_note : '',
      submitted: sub ? fmtDate(sub.submitted_at) : '',
      reviewed: sub ? fmtDate(sub.reviewed_at) : '',
    });
  });

  ws.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  return wb;
}

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  await wb.xlsx.write(res);
  res.end();
}

function safeName(name) {
  return String(name || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'brother';
}

// Staff: download any of their members' progress as Excel.
app.get('/api/staff/members/:id/export', authRequired, staffRequired, async (req, res) => {
  const member = db.prepare("SELECT id, name, email, tier, start_date FROM users WHERE id = ? AND role='member'").get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (!tiersFor(req.user).includes(member.tier)) return res.status(403).json({ error: 'Not in your challenge group.' });
  try {
    const wb = await buildMemberWorkbook(member);
    await sendWorkbook(res, wb, 'BMP_' + safeName(member.name) + '_progress.xlsx');
  } catch (e) {
    res.status(500).json({ error: 'Could not generate the spreadsheet.' });
  }
});

// Member: download their own progress as Excel.
app.get('/api/my/export', authRequired, async (req, res) => {
  const member = getUserById(req.user.id);
  if (!member || !member.tier) return res.status(400).json({ error: 'You are not assigned to a challenge yet.' });
  try {
    const wb = await buildMemberWorkbook(member);
    await sendWorkbook(res, wb, 'BMP_' + safeName(member.name) + '_progress.xlsx');
  } catch (e) {
    res.status(500).json({ error: 'Could not generate the spreadsheet.' });
  }
});

// ===========================================================================
// ADMIN (VPMD) — manage challenge items (requirements)
// ===========================================================================
app.get('/api/admin/requirements', authRequired, adminRequired, (req, res) => {
  const requirements = db.prepare('SELECT * FROM requirements ORDER BY tier, kind, sort_order, id').all();
  res.json({ requirements, tiers: TIERS });
});

app.post('/api/admin/requirements', authRequired, adminRequired, (req, res) => {
  const b = req.body || {};
  const tier = b.tier;
  if (!TIERS[tier]) return res.status(400).json({ error: 'Please choose a valid challenge (Sigma, Phi, or Epsilon).' });
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  const isMeeting = b.kind === 'meeting';
  const kind = isMeeting ? 'meeting' : (tier === 'sigma' ? 'checklist' : 'activity');
  const category = isMeeting ? 'Meetings' : (String(b.category || '').trim() || 'General');
  const description = String(b.description || '').trim() || null;
  const mandatory = b.mandatory ? 1 : 0;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM requirements WHERE tier=? AND kind=?').get(tier, kind).m;
  const info = db.prepare(
    'INSERT INTO requirements (tier, kind, category, title, description, sort_order, mandatory, active) VALUES (?,?,?,?,?,?,?,1)'
  ).run(tier, kind, category, title, description, maxOrder + 1, mandatory);
  res.json({ requirement: db.prepare('SELECT * FROM requirements WHERE id=?').get(info.lastInsertRowid) });
});

app.patch('/api/admin/requirements/:id', authRequired, adminRequired, (req, res) => {
  const r = db.prepare('SELECT * FROM requirements WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Item not found.' });
  const b = req.body || {};
  const title = b.title !== undefined ? String(b.title).trim() : r.title;
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  const category = b.category !== undefined ? (String(b.category).trim() || r.category) : r.category;
  const description = b.description !== undefined ? (String(b.description).trim() || null) : r.description;
  const mandatory = b.mandatory !== undefined ? (b.mandatory ? 1 : 0) : r.mandatory;
  const active = b.active !== undefined ? (b.active ? 1 : 0) : r.active;
  db.prepare('UPDATE requirements SET title=?, category=?, description=?, mandatory=?, active=? WHERE id=?')
    .run(title, category, description, mandatory, active, r.id);
  res.json({ requirement: db.prepare('SELECT * FROM requirements WHERE id=?').get(r.id) });
});

// "Remove" = hide it (active=0). History is preserved; restore via PATCH active:1.
app.delete('/api/admin/requirements/:id', authRequired, adminRequired, (req, res) => {
  const r = db.prepare('SELECT id FROM requirements WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Item not found.' });
  db.prepare('UPDATE requirements SET active=0 WHERE id=?').run(r.id);
  res.json({ ok: true });
});

// ===========================================================================
// Protected file serving for uploaded proof (staff or the owner only).
// ===========================================================================
app.get('/uploads/:file', authRequired, (req, res) => {
  const file = path.basename(req.params.file);
  const sub = db.prepare("SELECT s.*, u.tier AS member_tier FROM submissions s JOIN users u ON u.id=s.user_id WHERE s.proof_path = ?")
    .get(`/uploads/${file}`);
  if (!sub) return res.status(404).end();
  const isOwner = sub.user_id === req.user.id;
  const isStaff = (req.user.role === 'admin') ||
    (req.user.role === 'coordinator' && tiersFor(req.user).includes(sub.member_tier));
  if (!isOwner && !isStaff) return res.status(403).end();
  res.sendFile(path.join(UPLOAD_DIR, file));
});

// --- Static frontend ------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Multer / generic error handler
app.use((err, _req, res, _next) => {
  if (err) return res.status(400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => console.log(`\n  FIU SigEp BMP Tracker running at  http://localhost:${PORT}\n`));
