import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { REQUIREMENTS, SEED_USERS } from './bmp-data.js';

const reset = process.argv.includes('--reset');

if (reset) {
  console.log('Resetting submissions, requirements, and users…');
  db.exec('DELETE FROM submissions; DELETE FROM requirements; DELETE FROM users;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('submissions','requirements','users');");
}

// --- Requirements ---------------------------------------------------------
const reqCount = db.prepare('SELECT COUNT(*) c FROM requirements').get().c;
if (reqCount === 0) {
  const insert = db.prepare(`
    INSERT INTO requirements (tier, kind, category, title, description, sort_order, mandatory)
    VALUES (@tier, @kind, @category, @title, @description, @sort_order, @mandatory)
  `);
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(REQUIREMENTS);
  console.log(`Seeded ${REQUIREMENTS.length} requirements.`);
} else {
  console.log(`Requirements already present (${reqCount}). Skipping.`);
}

// --- Users ----------------------------------------------------------------
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role, tier)
  VALUES (@name, @email, @password_hash, @role, @tier)
`);
let added = 0;
for (const u of SEED_USERS) {
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(u.email);
  if (exists) continue;
  insertUser.run({
    name: u.name,
    email: u.email,
    password_hash: bcrypt.hashSync(u.password, 10),
    role: u.role,
    tier: u.tier,
  });
  added++;
}
console.log(`Seeded ${added} default account(s).`);
console.log('Done.');
