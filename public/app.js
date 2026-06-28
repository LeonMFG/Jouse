'use strict';

// ===========================================================================
// FIU SigEp Balanced Man Program Tracker — frontend SPA (no build step)
// ===========================================================================

const App = document.getElementById('app');
const ModalRoot = document.getElementById('modal-root');
const ToastRoot = document.getElementById('toast-root');

const state = {
  user: null,
  tiers: null,
  view: 'dashboard',     // dashboard | roster | queue | member
  memberId: null,        // when viewing a single member as staff
  authMode: 'login',
};

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) opts.body = form;
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { /* non-json (e.g. file) */ }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed.');
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  ToastRoot.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

const isStaff = () => state.user && (state.user.role === 'coordinator' || state.user.role === 'admin');

// ===========================================================================
// BOOT
// ===========================================================================
async function boot() {
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    state.tiers = data.tiers;
    state.view = isStaff() ? 'queue' : 'dashboard';
    render();
  } catch {
    renderAuth();
  }
}

// ===========================================================================
// AUTH SCREEN
// ===========================================================================
function renderAuth() {
  const login = state.authMode === 'login';
  App.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand">
          <div class="crest">ΣΦΕ</div>
          <h1>Balanced Man Program</h1>
          <p>FIU · Florida Nu — Sigma · Phi · Epsilon</p>
        </div>
        <div id="auth-error"></div>
        <form id="auth-form">
          ${login ? '' : `
            <div class="field">
              <label>Full name</label>
              <input name="name" autocomplete="name" placeholder="First Last" required />
            </div>`}
          <div class="field">
            <label>Username</label>
            <input name="username" type="text" autocomplete="username" placeholder="Your username" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" placeholder="••••••••" required />
          </div>
          ${login ? '' : `
            <div class="field">
              <label>Which challenge are you in?</label>
              <select name="tier" required>
                <option value="" disabled selected>Select your challenge…</option>
                <option value="sigma">Sigma Challenge (new member)</option>
                <option value="phi">Phi Challenge</option>
                <option value="epsilon">Epsilon Challenge</option>
              </select>
            </div>`}
          <button class="btn full" type="submit" id="auth-submit">${login ? 'Sign in' : 'Create account'}</button>
        </form>
        <div class="switch-auth">
          ${login ? "New member? <a id='to-register'>Create an account</a>"
                  : "Already have an account? <a id='to-login'>Sign in</a>"}
        </div>
        
      </div>
    </div>`;

  document.getElementById('to-register')?.addEventListener('click', () => { state.authMode = 'register'; renderAuth(); });
  document.getElementById('to-login')?.addEventListener('click', () => { state.authMode = 'login'; renderAuth(); });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = document.getElementById('auth-submit');
    btn.disabled = true; btn.textContent = login ? 'Signing in…' : 'Creating…';
    try {
      const payload = Object.fromEntries(f.entries());
      const data = await api(login ? '/auth/login' : '/auth/register', { method: 'POST', body: payload });
      state.user = data.user;
      const me = await api('/auth/me');
      state.tiers = me.tiers;
      state.view = isStaff() ? 'queue' : 'dashboard';
      render();
    } catch (err) {
      document.getElementById('auth-error').innerHTML = `<div class="error-banner">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = login ? 'Sign in' : 'Create account';
    }
  });
}

// ===========================================================================
// SHELL
// ===========================================================================
function renderShell(content) {
  const u = state.user;
  let tabs;
  if (isStaff()) {
    tabs = [['queue', 'Review Queue'], ['roster', 'My Members'], ['pending', 'Pending']];
    if (u.role === 'admin') { tabs.push(['roles', 'Manage Roles']); tabs.push(['challenges', 'Challenges']); }
  } else {
    tabs = [['dashboard', 'My Challenge']];
  }
  App.innerHTML = `
    <div class="shell">
      <div class="topbar">
        <div class="logo"><span class="dot">ΣΦΕ</span> BMP Tracker</div>
        <div class="spacer"></div>
        <div class="who"><b>${esc(u.name)}</b><span>${esc(u.role)}${u.tier ? ' · ' + u.tier : ''}</span></div>
        <button class="out" id="account">Account</button>
        <button class="out" id="logout">Sign out</button>
      </div>
      <div class="container">
        ${(state.view === 'member') ? '' : `<div class="tabs">${tabs.map(([k, label]) => {
          const count = (k === 'queue' && state._queueCount) || (k === 'pending' && state._pendingCount) || 0;
          return `<button class="tab ${state.view === k ? 'active' : ''}" data-tab="${k}">${label}${
            count ? `<span class="badge">${count}</span>` : ''}</button>`;
        }).join('')}</div>`}
        <div id="view">${content}</div>
      </div>
    </div>`;
  document.getElementById('logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.user = null; state.authMode = 'login'; renderAuth();
  });
  document.getElementById('account')?.addEventListener('click', openPasswordModal);
  App.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { state.view = b.dataset.tab; render(); }));
}

// ---------------------------------------------------------------------------
// Show a freshly reset temporary password for staff to hand to a brother.
// ---------------------------------------------------------------------------
function showTempPassword(name, pw) {
  ModalRoot.innerHTML = `
    <div class="modal-overlay" id="tp-overlay">
      <div class="modal" style="max-width:440px">
        <div class="modal-head">
          <h3>Temporary password for ${esc(name)}</h3>
          <p>Share this with them privately. They sign in with it, then set their own password from the <b>Account</b> button. This is the only time it's shown.</p>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:8px;align-items:center">
            <code style="flex:1;font-size:18px;font-weight:700;letter-spacing:.5px;background:#faf9fc;border:1px solid var(--line);border-radius:10px;padding:13px 15px;text-align:center">${esc(pw)}</code>
            <button class="btn ghost sm" id="tp-copy">Copy</button>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" id="tp-done">Done</button>
        </div>
      </div>
    </div>`;
  const close = () => { ModalRoot.innerHTML = ''; };
  document.getElementById('tp-done').addEventListener('click', close);
  document.getElementById('tp-overlay').addEventListener('click', (e) => { if (e.target.id === 'tp-overlay') close(); });
  document.getElementById('tp-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pw); toast('Copied', 'ok'); }
    catch { toast('Select and copy it manually', 'err'); }
  });
}

// ---------------------------------------------------------------------------
// Change-password modal (available to every signed-in user)
// ---------------------------------------------------------------------------
function openPasswordModal() {
  ModalRoot.innerHTML = `
    <div class="modal-overlay" id="pw-overlay">
      <div class="modal" style="max-width:440px">
        <div class="modal-head">
          <h3>Change your password</h3>
          <p>Signed in as ${esc(state.user.email)}.</p>
        </div>
        <div class="modal-body">
          <div id="pw-error"></div>
          <div class="field">
            <label>Current password</label>
            <input type="password" id="pw-current" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <div class="field">
            <label>New password</label>
            <input type="password" id="pw-new" autocomplete="new-password" placeholder="At least 6 characters" />
          </div>
          <div class="field">
            <label>Confirm new password</label>
            <input type="password" id="pw-confirm" autocomplete="new-password" placeholder="Re-type new password" />
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="pw-cancel">Cancel</button>
          <button class="btn" id="pw-save">Update password</button>
        </div>
      </div>
    </div>`;
  const close = () => { ModalRoot.innerHTML = ''; };
  document.getElementById('pw-cancel').addEventListener('click', close);
  document.getElementById('pw-overlay').addEventListener('click', (e) => { if (e.target.id === 'pw-overlay') close(); });

  document.getElementById('pw-save').addEventListener('click', async () => {
    const current = document.getElementById('pw-current').value;
    const next = document.getElementById('pw-new').value;
    const confirm2 = document.getElementById('pw-confirm').value;
    const err = (m) => document.getElementById('pw-error').innerHTML = `<div class="error-banner">${esc(m)}</div>`;
    if (!current) return err('Enter your current password.');
    if (next.length < 6) return err('Your new password must be at least 6 characters.');
    if (next !== confirm2) return err('The new passwords don\'t match.');
    const btn = document.getElementById('pw-save');
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      close(); toast('Password updated', 'ok');
    } catch (e) { err(e.message); btn.disabled = false; btn.textContent = 'Update password'; }
  });
}

// ===========================================================================
// ROUTER
// ===========================================================================
function render() {
  if (!state.user) return renderAuth();
  // A brother who hasn't been approved yet only sees a waiting screen.
  if (state.user.role === 'member' && state.user.status === 'pending') return renderWaiting();
  renderShell('<div class="skeleton">Loading…</div>');
  if (state.view === 'dashboard') renderDashboard();
  else if (state.view === 'roster') renderRoster();
  else if (state.view === 'queue') renderQueue();
  else if (state.view === 'pending') renderPending();
  else if (state.view === 'roles') renderRoles();
  else if (state.view === 'challenges') renderChallenges();
  else if (state.view === 'member') renderMemberDetail();
}

function renderWaiting() {
  const tierName = state.tiers?.[state.user.tier]?.name || 'your challenge';
  App.innerHTML = `
    <div class="shell">
      <div class="topbar">
        <div class="logo"><span class="dot">ΣΦΕ</span> BMP Tracker</div>
        <div class="spacer"></div>
        <div class="who"><b>${esc(state.user.name)}</b><span>${esc(state.user.tier || '')}</span></div>
        <button class="out" id="account">Account</button>
        <button class="out" id="logout">Sign out</button>
      </div>
      <div class="container">
        <div class="empty" style="padding-top:70px">
          <div class="big">⏳</div>
          <h2 class="section-title" style="margin-bottom:8px">You're almost in, ${esc(state.user.name.split(' ')[0])}!</h2>
          <p class="section-sub" style="max-width:440px;margin:0 auto">
            Your account for the <b>${esc(tierName)}</b> is waiting for your coordinator to approve it.
            You'll be able to see your requirements and submit completed tasks as soon as they do.
            Check back soon.
          </p>
        </div>
      </div>
    </div>`;
  document.getElementById('logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.user = null; state.authMode = 'login'; renderAuth();
  });
  document.getElementById('account')?.addEventListener('click', openPasswordModal);
}

// ===========================================================================
// MEMBER DASHBOARD
// ===========================================================================
function progressOf(items, rules) {
  const approved = (r) => r.submission && r.submission.status === 'approved';
  const meetings = items.filter((i) => i.kind === 'meeting');
  const activities = items.filter((i) => i.kind !== 'meeting');
  const meetingsDone = meetings.filter(approved).length;
  const activitiesDone = activities.filter(approved).length;
  const perCat = {};
  for (const a of activities) {
    perCat[a.category] ??= { total: 0, done: 0 };
    perCat[a.category].total++;
    if (approved(a)) perCat[a.category].done++;
  }
  const mandatory = activities.filter((a) => a.mandatory);
  const mandatoryDone = mandatory.filter(approved).length;
  const target = rules.activitiesMode === 'all' ? activities.length : rules.activitiesRequired;
  const minCatOk = rules.minPerCategory === 0 ||
    Object.values(perCat).every((c) => c.done >= rules.minPerCategory);
  const complete = meetingsDone >= rules.meetingsRequired &&
    activitiesDone >= target && minCatOk && mandatoryDone === mandatory.length;
  return { meetings, activities, meetingsDone, activitiesDone, perCat, mandatory, mandatoryDone, target, complete };
}

async function renderDashboard() {
  let data;
  try { data = await api('/my/progress'); } catch (e) { return showError(e); }
  if (!data.tier) {
    return setView(`<div class="empty"><div class="big">🤝</div>You're not assigned to a challenge yet. Ask your coordinator or the VPMD to set your tier.</div>`);
  }
  const rules = data.rules;
  const info = data.tierInfo;
  const p = progressOf(data.items, rules);

  const pct = Math.min(100, Math.round((p.activitiesDone / Math.max(1, p.target)) * 100));
  const mPct = Math.min(100, Math.round((p.meetingsDone / Math.max(1, rules.meetingsRequired)) * 100));

  const hero = `
    <div class="hero">
      <h2>${esc(info.name)}</h2>
      <p>${esc(info.blurb)}</p>
      <div class="meta">
        <div class="stat"><b>${p.meetingsDone}/${rules.meetingsRequired}</b><span>Meetings</span></div>
        <div class="stat"><b>${p.activitiesDone}/${p.target}</b><span>${rules.activitiesMode === 'all' ? 'Checklist' : 'Activities'}</span></div>
        <div class="stat"><b>${info.duration}</b><span>Timeframe</span></div>
      </div>
      ${p.complete ? `<div class="complete-pill">✓ All requirements complete — congratulations!</div>` : ''}
    </div>`;

  const summary = `
    <div class="summary-grid">
      <div class="card summary-card">
        <div class="label">Meetings attended</div>
        <div class="value">${p.meetingsDone}<small> / ${rules.meetingsRequired} required</small></div>
        <div class="bar ${mPct >= 100 ? 'green' : ''}"><i style="width:${mPct}%"></i></div>
      </div>
      <div class="card summary-card">
        <div class="label">${rules.activitiesMode === 'all' ? 'Checklist items' : 'Activities approved'}</div>
        <div class="value">${p.activitiesDone}<small> / ${p.target} ${rules.activitiesMode === 'all' ? 'total' : 'needed'}</small></div>
        <div class="bar ${pct >= 100 ? 'green' : ''}"><i style="width:${pct}%"></i></div>
      </div>
      ${p.mandatory.length ? `<div class="card summary-card">
        <div class="label">Mandatory items</div>
        <div class="value">${p.mandatoryDone}<small> / ${p.mandatory.length}</small></div>
        <div class="bar ${p.mandatoryDone >= p.mandatory.length ? 'green' : ''}"><i style="width:${Math.round(p.mandatoryDone / Math.max(1, p.mandatory.length) * 100)}%"></i></div>
      </div>` : ''}
    </div>`;

  // group items by kind/category preserving order
  const groups = groupItems(data.items);
  const groupsHtml = groups.map((g) => renderGroup(g, rules, p, /*staff*/ false)).join('');

  const exportMine = '<div style="margin:2px 0 14px"><button class="btn ghost sm" id="export-mine">⬇ Download my progress (Excel)</button></div>';
  setView(hero + exportMine + summary + groupsHtml);
  wireMemberItems();
  document.getElementById('export-mine')?.addEventListener('click', () => { window.location.assign('/api/my/export'); });
}

function groupItems(items) {
  const order = [];
  const map = new Map();
  for (const it of items) {
    const key = it.kind === 'meeting' ? 'Meetings' : it.category;
    if (!map.has(key)) { map.set(key, { name: key, kind: it.kind, items: [] }); order.push(key); }
    map.get(key).items.push(it);
  }
  return order.map((k) => map.get(k));
}

function renderGroup(g, rules, p, staff) {
  const isActivityCat = g.kind !== 'meeting' && rules.minPerCategory > 0;
  const catDone = p && p.perCat[g.name] ? p.perCat[g.name].done : null;
  const minTag = isActivityCat
    ? `<span class="min-tag ${catDone >= rules.minPerCategory ? 'ok' : ''}">${catDone}/${rules.minPerCategory} min</span>`
    : '';
  const doneCount = g.items.filter((i) => i.submission && i.submission.status === 'approved').length;
  return `
    <div class="group">
      <div class="group-head">
        <h3>${esc(g.name)}</h3>
        <span class="count">${doneCount}/${g.items.length} done</span>
        ${minTag}
      </div>
      ${g.items.map((it) => renderReq(it, staff)).join('')}
    </div>`;
}

function renderReq(it, staff) {
  const s = it.submission;
  const status = s ? s.status : 'todo';
  const dot = s ? s.status : '';
  const pillLabel = { approved: 'Approved', pending: 'Pending review', denied: 'Needs redo', todo: it.kind === 'meeting' ? 'Not attended' : 'Not started' }[status];
  let actionBtn = '';
  if (!staff) {
    if (status === 'todo') actionBtn = `<button class="btn sm" data-submit="${it.id}">Submit</button>`;
    else if (status === 'denied') actionBtn = `<button class="btn sm" data-submit="${it.id}">Resubmit</button>`;
    else if (status === 'pending') actionBtn = `<button class="btn ghost tiny" data-withdraw="${s.id}">Withdraw</button>`;
  } else {
    // staff member-detail quick actions
    if (status === 'approved') actionBtn = `<button class="btn ghost tiny" data-unmark="${it.id}">Reset</button>`;
    else actionBtn = `<button class="btn green sm" data-mark="${it.id}">Mark done</button>`;
  }
  const proof = s && s.proof_path
    ? `<a class="proof-link" href="${esc(s.proof_path)}" target="_blank" rel="noopener">📎 ${esc(s.proof_name || 'proof')}</a>` : '';
  const reflection = s && s.reflection && status !== 'todo'
    ? `<div class="sub-meta">${proof}</div>` : '';
  const note = s && s.review_note
    ? `<div class="note ${status === 'denied' ? 'denied' : ''}"><b>${status === 'denied' ? 'Coordinator:' : 'Note:'}</b> ${esc(s.review_note)}</div>` : '';
  return `
    <div class="req">
      <div class="status-dot ${dot}"></div>
      <div class="body">
        <div class="title">${esc(it.title)}${it.mandatory ? '<span class="mand">Mandatory</span>' : ''}</div>
        ${it.description ? `<div class="desc">${esc(it.description)}</div>` : ''}
        ${reflection}
        ${note}
      </div>
      <div class="right">
        <span class="pill ${status}">${pillLabel}</span>
        ${actionBtn}
      </div>
    </div>`;
}

function wireMemberItems() {
  App.querySelectorAll('[data-submit]').forEach((b) =>
    b.addEventListener('click', () => openSubmitModal(Number(b.dataset.submit))));
  App.querySelectorAll('[data-withdraw]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Withdraw this submission?')) return;
      try { await api(`/my/submissions/${b.dataset.withdraw}`, { method: 'DELETE' }); toast('Withdrawn', 'ok'); renderDashboard(); }
      catch (e) { toast(e.message, 'err'); }
    }));
}

// ---------------------------------------------------------------------------
// Submit modal (reflection + proof upload)
// ---------------------------------------------------------------------------
async function openSubmitModal(reqId) {
  const data = await api('/my/progress');
  const it = data.items.find((i) => i.id === reqId);
  if (!it) return;
  const existing = it.submission;
  ModalRoot.innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal">
        <div class="modal-head">
          <h3>${esc(it.title)}</h3>
          <p>Write a 2–3 sentence reflection on what you did, learned, or gained — then add a photo or PDF as proof. Your coordinator will review it.</p>
        </div>
        <div class="modal-body">
          <div id="modal-error"></div>
          <div class="field">
            <label>Your reflection</label>
            <textarea id="reflection" rows="5" placeholder="What did you do and what did you take away from it?">${esc(existing?.reflection || '')}</textarea>
            <div class="char-count"><span id="cc">0</span> characters</div>
          </div>
          <div class="field">
            <label>Proof (photo or PDF — optional but recommended)</label>
            <label class="filedrop" id="filedrop">
              <span id="filelabel">${existing?.proof_name ? '📎 ' + esc(existing.proof_name) + ' (replace?)' : 'Click to attach an image or PDF'}</span>
              <input type="file" id="proof" accept="image/*,application/pdf" hidden />
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="cancel">Cancel</button>
          <button class="btn" id="do-submit">${existing ? 'Resubmit' : 'Submit for review'}</button>
        </div>
      </div>
    </div>`;

  const ta = document.getElementById('reflection');
  const cc = document.getElementById('cc');
  const upd = () => cc.textContent = ta.value.trim().length;
  ta.addEventListener('input', upd); upd();

  const fileInput = document.getElementById('proof');
  const drop = document.getElementById('filedrop');
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      document.getElementById('filelabel').textContent = '📎 ' + fileInput.files[0].name;
      drop.classList.add('has');
    }
  });
  const close = () => { ModalRoot.innerHTML = ''; };
  document.getElementById('cancel').addEventListener('click', close);
  document.getElementById('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') close(); });

  document.getElementById('do-submit').addEventListener('click', async () => {
    const reflection = ta.value.trim();
    if (reflection.length < 10) {
      document.getElementById('modal-error').innerHTML = `<div class="error-banner">Please write at least a sentence or two.</div>`;
      return;
    }
    const btn = document.getElementById('do-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';
    const form = new FormData();
    form.append('requirement_id', reqId);
    form.append('reflection', reflection);
    if (fileInput.files[0]) form.append('proof', fileInput.files[0]);
    try {
      await api('/my/submissions', { method: 'POST', form });
      close(); toast('Submitted for review', 'ok'); renderDashboard();
    } catch (e) {
      document.getElementById('modal-error').innerHTML = `<div class="error-banner">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = existing ? 'Resubmit' : 'Submit for review';
    }
  });
}

// ===========================================================================
// COORDINATOR — REVIEW QUEUE
// ===========================================================================
async function renderQueue() {
  let data;
  try { data = await api('/staff/queue'); } catch (e) { return showError(e); }
  state._queueCount = data.submissions.length;
  if (data.pendingCount !== undefined) state._pendingCount = data.pendingCount;

  if (data.submissions.length === 0) {
    setView(`<h2 class="section-title">Review Queue</h2><p class="section-sub">Submissions from your members waiting on your approval.</p>
      <div class="empty"><div class="big">✅</div>All caught up — nothing waiting for review.</div>`);
    refreshBadge();
    return;
  }

  const cards = data.submissions.map((s) => `
    <div class="card queue-card" data-sub="${s.id}">
      <div class="qhead">
        <div>
          <div class="who-line"><b>${esc(s.member_name)}</b> · <span class="tier-chip">${esc(s.member_tier)}</span></div>
          <div class="title" style="font-weight:600;margin-top:6px;font-size:14.5px">${esc(s.req_title)}${s.mandatory ? '<span class="mand">Mandatory</span>' : ''}</div>
          <div class="desc" style="color:var(--muted);font-size:12.5px">${esc(s.req_category)} · ${esc(s.req_kind)} · submitted ${fmtDate(s.submitted_at)}</div>
        </div>
      </div>
      <div class="reflection">${esc(s.reflection)}</div>
      ${s.proof_path ? `<a class="proof-link" href="${esc(s.proof_path)}" target="_blank" rel="noopener">📎 View proof — ${esc(s.proof_name || 'attachment')}</a>` : '<div class="desc" style="font-size:12px;color:var(--muted)">No file attached.</div>'}
      <div class="actions" style="margin-top:12px">
        <input class="review-note-input" placeholder="Optional note to the member…" data-note="${s.id}" />
        <button class="btn green sm" data-approve="${s.id}">✓ Approve</button>
        <button class="btn rose sm" data-deny="${s.id}">✕ Send back</button>
      </div>
    </div>`).join('');

  setView(`<h2 class="section-title">Review Queue</h2>
    <p class="section-sub">${data.submissions.length} submission${data.submissions.length === 1 ? '' : 's'} from your members waiting on your approval.</p>${cards}`);
  refreshBadge();

  const review = async (id, decision) => {
    const note = App.querySelector(`[data-note="${id}"]`)?.value || '';
    try {
      await api(`/staff/submissions/${id}/review`, { method: 'POST', body: { decision, note } });
      toast(decision === 'approved' ? 'Approved' : 'Sent back to member', decision === 'approved' ? 'ok' : '');
      const card = App.querySelector(`[data-sub="${id}"]`);
      if (card) { card.style.transition = 'opacity .25s, transform .25s'; card.style.opacity = '0'; card.style.transform = 'translateX(20px)'; }
      setTimeout(renderQueue, 260);
    } catch (e) { toast(e.message, 'err'); }
  };
  App.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => review(b.dataset.approve, 'approved')));
  App.querySelectorAll('[data-deny]').forEach((b) => b.addEventListener('click', () => review(b.dataset.deny, 'denied')));
}

function setBadge(tabKey, count) {
  const tab = App.querySelector(`[data-tab="${tabKey}"]`);
  if (!tab) return;
  let badge = tab.querySelector('.badge');
  if (count > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; tab.appendChild(badge); }
    badge.textContent = count;
  } else if (badge) badge.remove();
}
function refreshBadge() {
  setBadge('queue', state._queueCount || 0);
  setBadge('pending', state._pendingCount || 0);
}
function renderShellTabsRefresh() { /* no-op placeholder kept for clarity */ }

// ===========================================================================
// COORDINATOR — MEMBER ROSTER
// ===========================================================================
async function renderRoster() {
  let data;
  try { data = await api('/staff/members'); } catch (e) { return showError(e); }
  state._pendingCount = data.pendingCount || 0;
  refreshBadge();
  const multiTier = data.tiers && data.tiers.length > 1;

  if (data.members.length === 0) {
    return setView(`<h2 class="section-title">My Members</h2><p class="section-sub">Brothers in your challenge group.</p>
      <div class="empty"><div class="big">👥</div>No members have signed up in your group yet.</div>`);
  }

  const filter = multiTier ? `
    <div class="filter-row">
      <label style="font-size:13px;color:var(--muted);font-weight:600">Filter:</label>
      <select id="tier-filter">
        <option value="">All challenges</option>
        ${data.tiers.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
      </select>
    </div>` : '';

  const rowFor = (m) => {
    const s = m.summary;
    const aPct = Math.min(100, Math.round(s.activities.done / Math.max(1, s.activities.target) * 100));
    return `
      <div class="roster-row" data-member="${m.id}" data-tier="${m.tier}">
        <div>
          <div class="name">${esc(m.name)} ${s.complete ? '✅' : ''}</div>
          <div class="email">${esc(m.email)}</div>
        </div>
        <div class="mini">
          <div class="labels"><span>Meetings ${s.meetings.done}/${s.meetings.required}</span><span>Activities ${s.activities.done}/${s.activities.target}</span></div>
          <div class="bar ${aPct >= 100 ? 'green' : ''}"><i style="width:${aPct}%"></i></div>
          ${s.pending ? `<div style="font-size:11px;color:var(--amber);font-weight:700;margin-top:5px">${s.pending} pending review</div>` : ''}
        </div>
        <div><span class="tier-chip">${esc(m.tier)}</span></div>
      </div>`;
  };

  setView(`<h2 class="section-title">My Members</h2>
    <p class="section-sub">${data.members.length} brother${data.members.length === 1 ? '' : 's'} in your challenge group. Click anyone to view and manage their progress.</p>
    ${filter}
    <div class="roster" id="roster">${data.members.map(rowFor).join('')}</div>`);

  App.querySelectorAll('[data-member]').forEach((r) =>
    r.addEventListener('click', () => { state.memberId = Number(r.dataset.member); state.view = 'member'; render(); }));
  document.getElementById('tier-filter')?.addEventListener('change', (e) => {
    const v = e.target.value;
    App.querySelectorAll('#roster [data-member]').forEach((r) => {
      r.style.display = (!v || r.dataset.tier === v) ? '' : 'none';
    });
  });
}

// ===========================================================================
// COORDINATOR — PENDING MEMBER APPROVALS
// ===========================================================================
async function renderPending() {
  let data;
  try { data = await api('/staff/pending'); } catch (e) { return showError(e); }
  state._pendingCount = data.pending.length;
  refreshBadge();

  if (data.pending.length === 0) {
    return setView(`<h2 class="section-title">Pending Members</h2>
      <p class="section-sub">Brothers who signed up and are waiting for you to approve them into your group.</p>
      <div class="empty"><div class="big">👍</div>No one is waiting — everyone's been approved.</div>`);
  }

  const cards = data.pending.map((m) => `
    <div class="card queue-card" data-pend="${m.id}">
      <div class="qhead">
        <div>
          <div class="who-line"><b>${esc(m.name)}</b> · <span class="tier-chip">${esc(m.tier)}</span></div>
          <div class="desc" style="color:var(--muted);font-size:12.5px">${esc(m.email)} · signed up ${fmtDate(m.created_at)}</div>
        </div>
        <div class="actions">
          <button class="btn green sm" data-approve="${m.id}">✓ Approve</button>
          <button class="btn ghost tiny" data-decline="${m.id}">Decline</button>
        </div>
      </div>
    </div>`).join('');

  setView(`<h2 class="section-title">Pending Members</h2>
    <p class="section-sub">${data.pending.length} brother${data.pending.length === 1 ? '' : 's'} waiting for approval. Approve to add them to your roster; decline to remove the sign-up.</p>${cards}`);

  App.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/staff/members/${b.dataset.approve}/approve`, { method: 'POST' }); toast('Approved — added to your roster', 'ok'); renderPending(); }
    catch (e) { toast(e.message, 'err'); }
  }));
  App.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Decline and remove this sign-up?')) return;
    try { await api(`/staff/members/${b.dataset.decline}/decline`, { method: 'POST' }); toast('Declined', ''); renderPending(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

// ===========================================================================
// ADMIN (VPMD) — MANAGE ROLES
// ===========================================================================
async function renderRoles() {
  let data;
  try { data = await api('/admin/users'); } catch (e) { return showError(e); }

  const tierOpts = (sel) => ['sigma', 'phi', 'epsilon']
    .map((t) => `<option value="${t}" ${sel === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('');
  const roleOpts = (sel) => ['member', 'coordinator', 'admin']
    .map((r) => `<option value="${r}" ${sel === r ? 'selected' : ''}>${r === 'admin' ? 'Admin (VPMD)' : r[0].toUpperCase() + r.slice(1)}</option>`).join('');

  const adminCount = data.users.filter((u) => u.role === 'admin').length;
  const rows = data.users.map((u) => {
    const isSelf = u.id === state.user.id;
    const badge = u.role === 'admin' ? '<span class="tier-chip" style="background:var(--red);color:#fff">VPMD</span>'
      : u.role === 'coordinator' ? `<span class="tier-chip">${u.tier} coord.</span>` : '';
    return `
      <div class="roster-row" style="cursor:default;grid-template-columns:1fr auto auto auto auto auto" data-row="${u.id}">
        <div>
          <div class="name">${esc(u.name)} ${badge} ${isSelf ? '<span class="tier-chip" style="background:#efeaf4">you</span>' : ''}</div>
          <div class="email">${esc(u.email)}${u.status === 'pending' ? ' · <b style="color:var(--amber)">pending</b>' : ''}</div>
        </div>
        <select class="role-sel" data-role="${u.id}">${roleOpts(u.role)}</select>
        <select class="tier-sel" data-tier="${u.id}" ${u.role === 'admin' ? 'style="visibility:hidden"' : ''}>${tierOpts(u.tier)}</select>
        <button class="btn sm" data-save="${u.id}" data-name="${esc(u.name)}" data-self="${isSelf ? 1 : 0}" data-was="${u.role}">Save</button>
        <button class="btn ghost sm" data-resetpw="${u.id}" data-name="${esc(u.name)}" ${isSelf ? 'style="visibility:hidden"' : ''}>Reset PW</button>
        <button class="btn rose sm" data-del="${u.id}" data-name="${esc(u.name)}" ${isSelf ? 'style="visibility:hidden"' : ''}>Delete</button>
      </div>`;
  }).join('');

  setView(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px"><h2 class="section-title" style="margin:0">Manage Roles</h2><button class="btn sm" id="create-acct">+ Create account</button></div>
    <p class="section-sub">Set who is the <b>VPMD (admin)</b> and who coordinates each challenge. Promoting someone to <b>Admin (VPMD)</b> gives them full chapter-wide access; a <b>Coordinator</b> manages just their own challenge (approving members, reviewing submissions, taking attendance). To hand off the VPMD, promote your successor to Admin first — then you can step yourself down.</p>
    <div class="roster">${rows}</div>`);

  // Hide/show tier select when role becomes admin.
  App.querySelectorAll('.role-sel').forEach((sel) => sel.addEventListener('change', () => {
    const tierSel = App.querySelector(`[data-tier="${sel.dataset.role}"]`);
    if (tierSel) tierSel.style.visibility = sel.value === 'admin' ? 'hidden' : 'visible';
  }));

  App.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.save;
    const role = App.querySelector(`[data-role="${id}"]`).value;
    const tier = App.querySelector(`[data-tier="${id}"]`).value;
    const isSelf = b.dataset.self === '1';
    const name = b.dataset.name;

    // Confirm sensitive changes.
    if (role === 'admin' && b.dataset.was !== 'admin' &&
        !confirm(`Give ${name} full VPMD (admin) access? They'll be able to manage every challenge and every brother — including roles.`)) return;
    if (isSelf && role !== 'admin' &&
        !confirm(`Step yourself down from VPMD to ${role}? You'll lose admin access immediately. Make sure another VPMD exists.`)) return;

    b.disabled = true; b.textContent = 'Saving…';
    try {
      const res = await api(`/admin/users/${id}/role`, { method: 'POST', body: { role, tier } });
      // If we just changed our own role, refresh the session and route to the right home.
      if (res.self) {
        const me = await api('/auth/me');
        state.user = me.user; state.tiers = me.tiers;
        state.view = isStaff() ? 'queue' : 'dashboard';
        toast('Your role was updated', 'ok');
        return render();
      }
      toast('Role updated', 'ok'); renderRoles();
    } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Save'; }
  }));

  App.querySelectorAll('[data-resetpw]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Reset ${b.dataset.name}'s password? Their current password stops working and you'll get a temporary one to give them.`)) return;
    try {
      const r = await api(`/admin/users/${b.dataset.resetpw}/reset-password`, { method: 'POST' });
      showTempPassword(r.name, r.tempPassword);
    } catch (e) { toast(e.message, 'err'); }
  }));

  document.getElementById('create-acct')?.addEventListener('click', openCreateAccountModal);
  App.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Delete ${b.dataset.name}'s account permanently?\n\nThis removes the account and everything they submitted. This cannot be undone.`)) return;
    try { await api(`/admin/users/${b.dataset.del}`, { method: 'DELETE' }); toast('Account deleted', 'ok'); renderRoles(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

// ===========================================================================
// COORDINATOR — MEMBER DETAIL
// ===========================================================================
async function renderMemberDetail() {
  let data;
  try { data = await api(`/staff/members/${state.memberId}`); } catch (e) { return showError(e); }
  const m = data.member;
  const info = data.tierInfo;
  const rules = info.rules;
  const p = progressOf(data.items, rules);
  const aPct = Math.min(100, Math.round(p.activitiesDone / Math.max(1, p.target) * 100));
  const mPct = Math.min(100, Math.round(p.meetingsDone / Math.max(1, rules.meetingsRequired) * 100));

  const hero = `
    <div class="hero">
      <h2>${esc(m.name)} ${data.summary.complete ? '✅' : ''}</h2>
      <p>${esc(m.email)} · ${esc(info.name)}${m.start_date ? ' · started ' + fmtDate(m.start_date) : ''}</p>
      <div class="meta">
        <div class="stat"><b>${p.meetingsDone}/${rules.meetingsRequired}</b><span>Meetings</span></div>
        <div class="stat"><b>${p.activitiesDone}/${p.target}</b><span>${rules.activitiesMode === 'all' ? 'Checklist' : 'Activities'}</span></div>
        ${p.mandatory.length ? `<div class="stat"><b>${p.mandatoryDone}/${p.mandatory.length}</b><span>Mandatory</span></div>` : ''}
      </div>
    </div>
    <div class="summary-grid">
      <div class="card summary-card"><div class="label">Meetings</div><div class="value">${p.meetingsDone}<small>/${rules.meetingsRequired}</small></div><div class="bar ${mPct >= 100 ? 'green' : ''}"><i style="width:${mPct}%"></i></div></div>
      <div class="card summary-card"><div class="label">${rules.activitiesMode === 'all' ? 'Checklist' : 'Activities'}</div><div class="value">${p.activitiesDone}<small>/${p.target}</small></div><div class="bar ${aPct >= 100 ? 'green' : ''}"><i style="width:${aPct}%"></i></div></div>
    </div>`;

  const groups = groupItems(data.items).map((g) => renderGroup(g, rules, p, /*staff*/ true)).join('');

  setView(`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <button class="back-link" id="back">← Back to my members</button>
      <button class="btn ghost sm" id="export-xls">⬇ Excel</button>
      <button class="btn ghost sm" id="reset-pw">Reset password</button>
      <button class="btn rose sm" id="del-member">Delete member</button>
    </div>
    <p class="section-sub" style="margin:6px 0 14px">You can approve a submitted item, or mark anything complete directly (e.g. taking meeting attendance).</p>
    ${hero}${groups}`);

  document.getElementById('back').addEventListener('click', () => { state.view = 'roster'; render(); });
  document.getElementById('export-xls')?.addEventListener('click', () => { window.location.assign('/api/staff/members/' + m.id + '/export'); });
  document.getElementById('del-member')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${m.name}'s account permanently?\n\nThis removes their account and everything they submitted. This cannot be undone.`)) return;
    try { await api(`/staff/members/${m.id}`, { method: 'DELETE' }); toast('Member deleted', 'ok'); state.view = 'roster'; render(); }
    catch (e) { toast(e.message, 'err'); }
  });
  document.getElementById('reset-pw').addEventListener('click', async () => {
    if (!confirm(`Reset ${m.name}'s password? Their current password stops working and you'll get a temporary one to give them.`)) return;
    try {
      const r = await api(`/staff/members/${m.id}/reset-password`, { method: 'POST' });
      showTempPassword(r.name, r.tempPassword);
    } catch (e) { toast(e.message, 'err'); }
  });

  const refresh = () => renderMemberDetail();
  App.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/staff/mark', { method: 'POST', body: { user_id: m.id, requirement_id: Number(b.dataset.mark) } }); toast('Marked complete', 'ok'); refresh(); }
    catch (e) { toast(e.message, 'err'); }
  }));
  App.querySelectorAll('[data-unmark]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Reset this item? It will clear the member\'s submission.')) return;
    try { await api('/staff/unmark', { method: 'POST', body: { user_id: m.id, requirement_id: Number(b.dataset.unmark) } }); toast('Reset', 'ok'); refresh(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

// ===========================================================================
// helpers
// ===========================================================================
function setView(html) { const v = document.getElementById('view'); if (v) v.innerHTML = html; else { renderShell(html); } }
function showError(e) { setView(`<div class="empty"><div class="big">⚠️</div>${esc(e.message)}</div>`); }
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===========================================================================
// ADMIN (VPMD) — MANAGE CHALLENGES (requirements)
// ===========================================================================
async function renderChallenges() {
  let data;
  try { data = await api('/admin/requirements'); } catch (e) { return showError(e); }
  const tiers = ['sigma', 'phi', 'epsilon'];
  const tierName = { sigma: 'Sigma', phi: 'Phi', epsilon: 'Epsilon' };
  const cur = state.challTier || 'sigma';
  const showHidden = !!state.challShowHidden;

  const all = data.requirements.filter((r) => r.tier === cur);
  const items = all.filter((r) => (showHidden ? r.active === 0 : r.active === 1));
  const hiddenCount = all.filter((r) => r.active === 0).length;

  const meetings = items.filter((r) => r.kind === 'meeting');
  const activities = items.filter((r) => r.kind !== 'meeting');
  const catOrder = [];
  const byCat = new Map();
  for (const a of activities) {
    if (!byCat.has(a.category)) { byCat.set(a.category, []); catOrder.push(a.category); }
    byCat.get(a.category).push(a);
  }

  const itemRow = (r) => `
    <div class="req">
      <div class="status-dot ${r.active ? '' : 'denied'}"></div>
      <div class="body">
        <div class="title">${esc(r.title)}${r.mandatory ? '<span class="mand">Mandatory</span>' : ''}</div>
        ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
      </div>
      <div class="right">
        ${showHidden
          ? `<button class="btn green sm" data-restore="${r.id}">Restore</button>`
          : `<button class="btn ghost tiny" data-edit="${r.id}">Edit</button>
             <button class="btn rose sm" data-remove="${r.id}">Remove</button>`}
      </div>
    </div>`;

  const groupHtml = (name, rows) => `
    <div class="group">
      <div class="group-head"><h3>${esc(name)}</h3><span class="count">${rows.length}</span></div>
      ${rows.map(itemRow).join('')}
    </div>`;

  const listHtml = items.length
    ? (meetings.length ? groupHtml('Meetings', meetings) : '') + catOrder.map((c) => groupHtml(c, byCat.get(c))).join('')
    : `<div class="empty"><div class="big">📋</div>${showHidden ? 'No hidden items in this challenge.' : 'No items yet — use “Add item”.'}</div>`;

  const tabsHtml = tiers.map((t) =>
    `<button class="tab ${t === cur ? 'active' : ''}" data-ctier="${t}">${tierName[t]}</button>`).join('');

  setView(`
    <h2 class="section-title">Manage Challenges</h2>
    <p class="section-sub">Add, edit, or hide the meetings and activities in each challenge. Changes apply to everyone in that challenge. Hiding an item removes it from dashboards but keeps all past records.</p>
    <div class="tabs">${tabsHtml}</div>
    <div class="filter-row" style="justify-content:space-between">
      <button class="btn sm" id="add-item">+ Add item</button>
      <label style="font-size:13px;color:var(--muted);font-weight:600;display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="show-hidden" ${showHidden ? 'checked' : ''}/> Show hidden${hiddenCount ? ' (' + hiddenCount + ')' : ''}
      </label>
    </div>
    <div id="chall-list">${listHtml}</div>`);

  App.querySelectorAll('[data-ctier]').forEach((b) => b.addEventListener('click', () => {
    state.challTier = b.dataset.ctier; state.challShowHidden = false; renderChallenges();
  }));
  document.getElementById('show-hidden').addEventListener('change', (e) => {
    state.challShowHidden = e.target.checked; renderChallenges();
  });
  document.getElementById('add-item').addEventListener('click', () => openItemModal(cur, null, data));

  App.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const r = data.requirements.find((x) => x.id === Number(b.dataset.edit));
    if (r) openItemModal(cur, r, data);
  }));
  App.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    const r = data.requirements.find((x) => x.id === Number(b.dataset.remove));
    if (!r) return;
    if (!confirm(`Hide “${r.title}”?\n\nIt will disappear from members’ dashboards, but every past submission and approval is kept. You can bring it back anytime with “Show hidden”.`)) return;
    try { await api(`/admin/requirements/${r.id}`, { method: 'DELETE' }); toast('Item hidden', 'ok'); renderChallenges(); }
    catch (e) { toast(e.message, 'err'); }
  }));
  App.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/admin/requirements/${b.dataset.restore}`, { method: 'PATCH', body: { active: 1 } }); toast('Item restored', 'ok'); renderChallenges(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

function openItemModal(tier, existing, data) {
  const isEdit = !!existing;
  const isMeeting = isEdit ? existing.kind === 'meeting' : false;
  const cats = [...new Set(data.requirements
    .filter((r) => r.tier === tier && r.kind !== 'meeting')
    .map((r) => r.category).filter(Boolean))];
  const curCat = existing && existing.category && existing.category !== 'Meetings' ? existing.category : '';

  ModalRoot.innerHTML = `
    <div class="modal-overlay" id="ci-overlay">
      <div class="modal" style="max-width:520px">
        <div class="modal-head">
          <h3>${isEdit ? 'Edit item' : 'Add item'} — ${tier[0].toUpperCase() + tier.slice(1)} Challenge</h3>
        </div>
        <div class="modal-body">
          <div id="ci-error"></div>
          ${isEdit ? '' : `
          <div class="field">
            <label>Type</label>
            <select id="ci-kind">
              <option value="activity">Activity / checklist item</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>`}
          <div class="field" id="ci-cat-field" ${isMeeting ? 'style="display:none"' : ''}>
            <label>Category</label>
            <input id="ci-category" list="ci-cats" placeholder="e.g. Sound Mind" value="${esc(curCat)}" />
            <datalist id="ci-cats">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
          </div>
          <div class="field">
            <label>Title</label>
            <input id="ci-title" placeholder="What should the brother do?" value="${esc(existing ? existing.title : '')}" />
          </div>
          <div class="field">
            <label>Description (optional)</label>
            <textarea id="ci-desc" rows="3" placeholder="Extra detail shown under the title">${esc(existing && existing.description ? existing.description : '')}</textarea>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="ci-mand" ${existing && existing.mandatory ? 'checked' : ''}/> Mandatory item</label>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="ci-cancel">Cancel</button>
          <button class="btn" id="ci-save">${isEdit ? 'Save changes' : 'Add item'}</button>
        </div>
      </div>
    </div>`;

  const close = () => { ModalRoot.innerHTML = ''; };
  document.getElementById('ci-cancel').addEventListener('click', close);
  document.getElementById('ci-overlay').addEventListener('click', (e) => { if (e.target.id === 'ci-overlay') close(); });
  const kindSel = document.getElementById('ci-kind');
  if (kindSel) kindSel.addEventListener('change', () => {
    document.getElementById('ci-cat-field').style.display = kindSel.value === 'meeting' ? 'none' : '';
  });

  document.getElementById('ci-save').addEventListener('click', async () => {
    const title = document.getElementById('ci-title').value.trim();
    const description = document.getElementById('ci-desc').value.trim();
    const mandatory = document.getElementById('ci-mand').checked;
    const err = (m) => document.getElementById('ci-error').innerHTML = `<div class="error-banner">${esc(m)}</div>`;
    if (!title) return err('Please enter a title.');
    const btn = document.getElementById('ci-save'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (isEdit) {
        const category = isMeeting ? 'Meetings' : (document.getElementById('ci-category').value.trim() || 'General');
        await api(`/admin/requirements/${existing.id}`, { method: 'PATCH', body: { title, description, mandatory, category } });
      } else {
        const kind = kindSel.value;
        const category = kind === 'meeting' ? 'Meetings' : (document.getElementById('ci-category').value.trim() || 'General');
        await api('/admin/requirements', { method: 'POST', body: { tier, kind, category, title, description, mandatory } });
      }
      close(); toast('Saved', 'ok'); renderChallenges();
    } catch (e) { err(e.message); btn.disabled = false; btn.textContent = isEdit ? 'Save changes' : 'Add item'; }
  });
}

function openCreateAccountModal() {
  ModalRoot.innerHTML = `
    <div class="modal-overlay" id="ca-overlay">
      <div class="modal" style="max-width:480px">
        <div class="modal-head">
          <h3>Create an account</h3>
          <p>Set a username and password, then hand them to the person. They can change their password later from the <b>Account</b> button.</p>
        </div>
        <div class="modal-body">
          <div id="ca-error"></div>
          <div class="field"><label>Full name</label><input id="ca-name" autocomplete="off" placeholder="First Last" /></div>
          <div class="field"><label>Username</label><input id="ca-username" autocomplete="off" placeholder="e.g. jsmith" /></div>
          <div class="field"><label>Password</label><input id="ca-password" type="text" autocomplete="off" placeholder="At least 6 characters" /></div>
          <div class="field"><label>Role</label>
            <select id="ca-role">
              <option value="member">Member</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin (VPMD)</option>
            </select>
          </div>
          <div class="field" id="ca-tier-field"><label>Challenge</label>
            <select id="ca-tier">
              <option value="sigma">Sigma</option>
              <option value="phi">Phi</option>
              <option value="epsilon">Epsilon</option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="ca-cancel">Cancel</button>
          <button class="btn" id="ca-save">Create account</button>
        </div>
      </div>
    </div>`;
  const close = () => { ModalRoot.innerHTML = ''; };
  document.getElementById('ca-cancel').addEventListener('click', close);
  document.getElementById('ca-overlay').addEventListener('click', (e) => { if (e.target.id === 'ca-overlay') close(); });
  const roleSel = document.getElementById('ca-role');
  roleSel.addEventListener('change', () => {
    document.getElementById('ca-tier-field').style.display = roleSel.value === 'admin' ? 'none' : '';
  });
  document.getElementById('ca-save').addEventListener('click', async () => {
    const name = document.getElementById('ca-name').value.trim();
    const username = document.getElementById('ca-username').value.trim();
    const password = document.getElementById('ca-password').value;
    const role = roleSel.value;
    const tier = role === 'admin' ? null : document.getElementById('ca-tier').value;
    const err = (m) => document.getElementById('ca-error').innerHTML = `<div class="error-banner">${esc(m)}</div>`;
    if (!name) return err('Enter a full name.');
    if (!username) return err('Enter a username.');
    if (password.length < 6) return err('Password must be at least 6 characters.');
    const btn = document.getElementById('ca-save'); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await api('/admin/users', { method: 'POST', body: { name, username, password, role, tier } });
      close(); toast('Account created', 'ok'); renderRoles();
    } catch (e) { err(e.message); btn.disabled = false; btn.textContent = 'Create account'; }
  });
}


boot();
