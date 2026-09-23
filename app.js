'use strict';
/* =========================================================
   THE SYSTEM — Solo Leveling style daily quest tracker
   Data: local (encrypted) cache + Google Drive (system-db.json)
   AI:   Claude (scheduled) or Haiku fallback write ai-plan-YYYY-MM-DD.json
   ========================================================= */

// ---------- utils
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => Date.now();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').trim().toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
const te = new TextEncoder(), td = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------- game constants
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const RANK_XP = { E: 10, D: 20, C: 40, B: 70, A: 120, S: 200 };
const RANK_MIN = { E: 15, D: 25, C: 40, B: 60, A: 90, S: 120 };
const STATS = { STR: 'Strength', INT: 'Intelligence', AGI: 'Agility', VIT: 'Vitality', PER: 'Perception' };
const STAT_HINT = { STR: 'fitness, sport', INT: 'study, code, reading', AGI: 'chores, errands, speed', VIT: 'health, sleep, food', PER: 'social, career, networking' };
const STAT_WORDS = {
  STR: ['gym', 'run', 'workout', 'push', 'squat', 'train', 'sport', 'swim', 'bike', 'walk', 'exercise', 'lift', 'abs'],
  INT: ['study', 'read', 'code', 'learn', 'course', 'exam', 'homework', 'book', 'write', 'research', 'leetcode', 'cuda', 'gpu', 'lecture', 'thesis'],
  AGI: ['clean', 'buy', 'shop', 'laundry', 'fix', 'pay', 'order', 'cook', 'wash', 'tidy', 'errand', 'send', 'bank'],
  VIT: ['sleep', 'water', 'doctor', 'meditat', 'stretch', 'rest', 'eat', 'vitamin', 'dentist', 'breakfast'],
  PER: ['call', 'meet', 'apply', 'job', 'interview', 'linkedin', 'email', 'network', 'friend', 'family', 'cv', 'resume']
};
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AWAKEN_LEVEL = 30, AWAKEN_BONUS = 0.10;
const ITEMS = {
  skip: { name: 'Skip Token', icon: '⏭', cost: 120, desc: 'Drop one of today\'s quests without a penalty' },
  shield: { name: 'Streak Shield', icon: '⛨', cost: 200, desc: 'Absorbs one failed daily quest — no penalty, streak kept' },
  potion: { name: 'EXP Potion', icon: '⚗', cost: 150, desc: 'Double EXP until the day resets' }
};
const TITLES = [
  { id: 'awakened', name: 'The Awakened', desc: 'Reach level 2', test: p => p.level >= 2 },
  { id: 'wolf', name: 'Wolf Slayer', desc: 'Complete 10 tasks', test: p => p.doneCount >= 10 },
  { id: 'relentless', name: 'Relentless', desc: '7-day streak', test: p => p.bestStreak >= 7 },
  { id: 'iron', name: 'Iron Body', desc: 'STR 30', test: p => p.stats.STR >= 30 },
  { id: 'scholar', name: 'Scholar of the Abyss', desc: 'INT 30', test: p => p.stats.INT >= 30 },
  { id: 'swift', name: 'Swift Shadow', desc: 'AGI 30', test: p => p.stats.AGI >= 30 },
  { id: 'dungeon', name: 'Dungeon Breaker', desc: 'Clear an S-rank task', test: p => p.sClears >= 1 },
  { id: 'survivor', name: 'Penalty Zone Survivor', desc: 'Complete a penalty quest', test: p => p.penaltyClears >= 1 },
  { id: 'daily', name: 'The One Who Doesn\'t Skip', desc: 'Clear 30 daily quests', test: p => p.dailyClears >= 30 },
  { id: 'hoarder', name: 'Gold Hoarder', desc: 'Earn 2000 gold total', test: p => p.goldEarned >= 2000 },
  { id: 'monarch', name: 'Shadow Monarch', desc: 'Reach level 70', test: p => p.level >= 70 },
  { id: 'conqueror', name: 'Dungeon Conqueror', desc: 'Clear 5 dungeons', test: p => p.medals.length >= 5 },
  { id: 'army', name: 'Commander of Shadows', desc: '100 shadows in your army', test: p => p.doneCount >= 100 },
  { id: 'awakened1', name: 'The Awakened One', desc: 'Awaken once', test: p => p.awakenings >= 1 },
  { id: 'awakened3', name: 'Beyond the Limit', desc: 'Awaken 3 times', test: p => p.awakenings >= 3 }
];
const HUNTER_RANKS = [[1, 'E'], [10, 'D'], [20, 'C'], [35, 'B'], [50, 'A'], [70, 'S'], [90, 'National'], [110, 'Monarch']];

// ---------- DB
const DEFAULT_SETTINGS = {
  name: 'Hunter', tz: 5, resetHour: 4, dailyMinutes: 180, maxQuests: 6, fallbackHour: 6,
  autoHaiku: true, model: 'claude-haiku-4-5', sound: true, title: '', standing: '', updatedAt: 0
};
function emptyDB() {
  return { schema: 1, tasks: {}, log: {}, shop: {}, plans: {}, notes: {}, settings: { ...DEFAULT_SETTINGS }, security: { updatedAt: 0 } };
}
let db = emptyDB();
let cryptoKey = null;          // AES key derived from password (session only)
let apiKeyCache = null;         // decrypted Anthropic key (memory only)
let tab = LS.get('ss_tab', 'quests');
let ui = { showDone: false, showSched: false };

function S() { return db.settings; }
function touch(o) { o.updatedAt = now(); return o; }

// ---------- time (day starts at resetHour in fixed tz)
function dayKey(t = now()) { const s = S(); return new Date(t + (s.tz - s.resetHour) * 3600e3).toISOString().slice(0, 10); }
function hourInDay(t = now()) { const s = S(); const h = new Date(t + s.tz * 3600e3).getUTCHours(); return h < s.resetHour ? h + 24 : h; }
function dayEndTs(key) { const s = S(); return Date.parse(addDays(key, 1) + 'T00:00:00Z') - (s.tz - s.resetHour) * 3600e3; }
function addDays(key, n) { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(key, n) { const d = new Date(key + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
function weekday(key) { return new Date(key + 'T00:00:00Z').getUTCDay(); }
function fmtDay(key) { if (!key) return ''; const t = today(); if (key === t) return 'today'; if (key === addDays(t, 1)) return 'tomorrow'; if (key === addDays(t, -1)) return 'yesterday'; const d = new Date(key + 'T00:00:00Z'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
const today = () => dayKey();

// ---------- crypto
async function deriveKey(pw, saltB64) {
  const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encStr(key, str) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(str)); return { iv: b64(iv), ct: b64(ct) }; }
async function decStr(key, o) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct)); return td.decode(pt); }
const VERIFIER = 'ARISE::SOLO-SYSTEM';

// IndexedDB for "remember this device" (stores non-extractable CryptoKey)
const IDB = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('ss', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const d = await this.open(); return await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { try { const d = await this.open(); await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch { } },
  async del(k) { try { const d = await this.open(); await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); } catch { } }
};

// ---------- persistence (local cache is encrypted with the password key)
let saveChain = Promise.resolve();
function persistLocal() {
  if (!cryptoKey) return;
  const snapshot = JSON.stringify(db);
  saveChain = saveChain.then(async () => {
    LS.set('ss_db_enc', await encStr(cryptoKey, snapshot));
    LS.set('ss_security', db.security);
  }).catch(e => console.warn(e));
}
function save(opts = {}) {
  LS.set('ss_dirty', true);
  persistLocal();
  if (!opts.noSync) scheduleSync(1200);
  if (!opts.noRender) render();
}

// ---------- merge (last-writer-wins per item)
function mergeMaps(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) { if (!out[k] || (v.updatedAt || 0) > (out[k].updatedAt || 0)) out[k] = v; }
  return out;
}
function mergeDB(a, b) {
  if (!b) return a; if (!a) return b;
  const m = emptyDB();
  for (const c of ['tasks', 'log', 'shop', 'plans', 'notes']) m[c] = mergeMaps(a[c], b[c]);
  m.settings = { ...DEFAULT_SETTINGS, ...((b.settings?.updatedAt || 0) > (a.settings?.updatedAt || 0) ? b.settings : a.settings) };
  m.security = (b.security?.updatedAt || 0) > (a.security?.updatedAt || 0) ? b.security : a.security;
  return m;
}
function stableDB(d) { const c = { ...d }; return JSON.stringify(c); }

// ---------- tasks
function guessStat(title) {
  const t = norm(title);
  for (const [st, words] of Object.entries(STAT_WORDS)) if (words.some(w => t.includes(w))) return st;
  return 'INT';
}
function newTask(title, extra = {}) {
  const t = {
    id: uid(), title: title.trim(), notes: '', done: false, doneAt: 0, createdAt: now(), updatedAt: now(), deleted: false,
    deadline: '', rank: 'E', stat: guessStat(title), subtasks: [], reward: { text: '', gold: 0 },
    repeat: { type: 'none', every: 1, days: [] }, nextDay: '', pinDay: '', origin: 'user', dungeon: false, hint: '', ...extra
  };
  db.tasks[t.id] = t; return t;
}
const liveTasks = () => Object.values(db.tasks).filter(t => !t.deleted);
function isActive(t) { return !t.deleted && !t.done && (!t.nextDay || t.nextDay <= today()); }
function isScheduled(t) { return !t.deleted && !t.done && t.nextDay && t.nextDay > today(); }
function repeatLabel(r) {
  if (!r || r.type === 'none') return '';
  if (r.type === 'daily') return '↻ daily';
  if (r.type === 'interval') return `↻ every ${r.every}d`;
  if (r.type === 'after') return `↻ ${r.every}d after done`;
  if (r.type === 'weekly') return '↻ ' + (r.days || []).map(d => DAYS[d]).join(' ');
  if (r.type === 'monthly') return '↻ monthly';
  return '';
}
function nextOccurrence(t) {
  const r = t.repeat, d = today();
  if (r.type === 'daily') return addDays(d, 1);
  if (r.type === 'interval' || r.type === 'after') return addDays(d, Math.max(1, +r.every || 1));
  if (r.type === 'monthly') return addMonths(d, 1);
  if (r.type === 'weekly') {
    const days = (r.days || []).length ? r.days : [weekday(d)];
    for (let i = 1; i <= 7; i++) { const k = addDays(d, i); if (days.includes(weekday(k))) return k; }
  }
  return '';
}
function questFor(taskId, subId = null, date = today()) {
  const p = db.plans[date]; if (!p) return null;
  return p.quests.find(q => q.taskId === taskId && (subId ? q.subId === subId : !q.subId)) || null;
}
function logAdd(e) { e.id = e.id || uid(); e.at = now(); e.day = today(); touch(e); db.log[e.id] = e; return e; }
function completeTask(t) {
  const before = player();
  const q = questFor(t.id);
  const base = q?.xp || Math.round(RANK_XP[t.rank] * (t.pinDay === today() ? 1.2 : 1));
  const xp = Math.round(base * before.xpMult);
  const gold = Math.round((q?.gold ?? Math.round(base / 2)) * (before.potionActive ? 1 : 1)) + (+t.reward?.gold || 0);
  logAdd({ type: 'done', taskId: t.id, title: t.title, xp, gold, stat: t.stat, rank: t.rank, origin: t.origin, dungeon: !!t.dungeon });
  if (t.repeat?.type && t.repeat.type !== 'none') {
    t.nextDay = nextOccurrence(t); t.subtasks.forEach(s => s.done = false); t.lastDone = today();
  } else { t.done = true; t.doneAt = now(); }
  touch(t);
  sfx('done');
  if (t.dungeon) popup({ cls: 'levelup', title: 'Dungeon Cleared', text: `「${esc(t.title)}」<br>Medal acquired.`, reward: `+${xp} XP · +${gold} G` });
  else popup({ title: 'Quest Completed', text: esc(t.title), reward: `+${xp} XP · +${gold} G${t.reward?.text ? '<br>🎁 ' + esc(t.reward.text) : ''}` });
  afterProgress(before);
  save();
}
function uncompleteTask(t) {
  const entry = Object.values(db.log).filter(e => e.type === 'done' && e.taskId === t.id && !e.deleted).sort((a, b) => b.at - a.at)[0];
  if (entry) { entry.deleted = true; touch(entry); }
  t.done = false; t.doneAt = 0; if (t.repeat?.type !== 'none') t.nextDay = ''; touch(t); save();
}
function toggleSub(t, s) {
  const before = player();
  s.done = !s.done;
  if (s.done) {
    const q = questFor(t.id, s.id);
    const xp = Math.round((q?.xp || 5) * before.xpMult), gold = q?.gold ?? 2;
    logAdd({ type: 'sub', taskId: t.id, subId: s.id, title: s.title, xp, gold, stat: t.stat });
    sfx('tick'); toast(`+${xp} XP · ${esc(s.title)}`);
  } else {
    const e = Object.values(db.log).find(e => e.type === 'sub' && e.subId === s.id && !e.deleted && e.day === today());
    if (e) { e.deleted = true; touch(e); }
  }
  touch(t);
  afterProgress(before);
  save();
}
function afterProgress(before) {
  const after = player();
  if (after.level > before.level) setTimeout(() => { sfx('level'); popup({ cls: 'levelup', title: 'LEVEL UP!', text: `You have reached <b>Level ${after.level}</b>.<br>Hunter Rank: <b>${after.hunter}</b>`, reward: 'All stats restored.' }); }, 700);
  const newTitles = TITLES.filter(ti => ti.test(after) && !ti.test(before));
  newTitles.forEach((ti, i) => setTimeout(() => { sfx('level'); popup({ title: 'Title Acquired', text: `「${esc(ti.name)}」`, reward: esc(ti.desc) }); }, 1400 + i * 600));
  checkDailyClear();
}

// ---------- player (derived from log → merge-safe)
function levelFrom(xp) { let l = 1, need = 100, rest = xp; while (rest >= need) { rest -= need; l++; need = 100 + (l - 1) * 40; } return { level: l, cur: rest, need }; }
function player() {
  let rawXp = 0, spentXp = 0, awakenings = 0, goldEarned = 0, goldSpent = 0, doneCount = 0, sClears = 0, penaltyClears = 0, dailyClears = 0;
  const statXp = { STR: 0, INT: 0, AGI: 0, VIT: 0, PER: 0 };
  const byDay = {}, xpByDay = {}, medals = [], shadows = [], inv = { skip: 0, shield: 0, potion: 0 }, shieldDays = new Set();
  let potionDay = '';
  for (const e of Object.values(db.log).sort((a, b) => a.at - b.at)) {
    if (e.deleted) continue;
    if (e.type === 'done' || e.type === 'sub' || e.type === 'bonus') {
      rawXp += +e.xp || 0; goldEarned += +e.gold || 0;
      if (e.stat && statXp[e.stat] != null) statXp[e.stat] += +e.xp || 0;
      xpByDay[e.day] = (xpByDay[e.day] || 0) + (+e.xp || 0);
      if (e.type !== 'bonus') byDay[e.day] = (byDay[e.day] || 0) + 1;
      if (e.type === 'done') {
        doneCount++; if (e.rank === 'S') sClears++; if (e.origin === 'penalty') penaltyClears++;
        shadows.push({ name: e.title, rank: e.rank || 'E', day: e.day, stat: e.stat });
        if (e.dungeon) medals.push({ name: e.title, rank: e.rank || 'C', day: e.day });
      }
      if (e.type === 'bonus') dailyClears++;
    }
    if (e.type === 'buy') goldSpent += +e.cost || 0;
    if (e.type === 'item') { goldSpent += +e.cost || 0; if (inv[e.key] != null) inv[e.key]++; }
    if (e.type === 'use') {
      if (inv[e.key] != null) inv[e.key] = Math.max(0, inv[e.key] - 1);
      if (e.key === 'shield') shieldDays.add(e.forDay || e.day);
      if (e.key === 'potion') potionDay = e.day;
    }
    if (e.type === 'awaken') { awakenings++; spentXp += +e.xpSpent || 0; }
  }
  const xp = Math.max(0, rawXp - spentXp);
  const lv = levelFrom(xp);
  const stats = {}; for (const k in statXp) stats[k] = 10 + Math.floor(statXp[k] / 25);
  let hunter = 'E'; for (const [l, r] of HUNTER_RANKS) if (lv.level >= l) hunter = r;
  // streak: consecutive days with ≥1 completion (a shielded day counts), ending today or yesterday
  const alive = d => byDay[d] || shieldDays.has(d);
  let streak = 0, d = today(); if (!alive(d)) d = addDays(d, -1);
  while (alive(d)) { streak++; d = addDays(d, -1); }
  const days = [...new Set([...Object.keys(byDay), ...shieldDays])].sort(); let best = 0, run = 0, prev = null;
  for (const k of days) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return {
    xp, totalXp: rawXp, ...lv, gold: goldEarned - goldSpent, goldEarned, stats, hunter, streak, bestStreak: best,
    doneCount, sClears, penaltyClears, dailyClears, byDay, xpByDay, awakenings, medals, shadows, inv, shieldDays,
    potionActive: potionDay === today(), xpMult: (1 + AWAKEN_BONUS * awakenings) * (potionDay === today() ? 2 : 1)
  };
}
function awaken() {
  const p = player(); if (p.level < AWAKEN_LEVEL) return;
  logAdd({ type: 'awaken', xpSpent: p.xp, level: p.level });
  sfx('level');
  popup({ cls: 'levelup', title: 'AWAKENING', text: `You have shed your limits.<br>Level reset to 1 — stats, gold and titles remain.`, reward: `Permanent EXP bonus: +${Math.round((p.awakenings + 1) * AWAKEN_BONUS * 100)}%` });
  save();
}

// ---------- daily plan
function planStatus(p) {
  if (!p) return { done: 0, total: 0 };
  let done = 0, total = 0;
  for (const q of p.quests) { if (q.blocked) continue; total++; if (questDone(q, p.date)) done++; }
  return { done, total };
}
function questDone(q, date) {
  if (q.skipped) return true;
  const t = db.tasks[q.taskId]; if (!t) return true; // removed → don't block
  if (q.subId) { const s = t.subtasks.find(x => x.id === q.subId); return !s || s.done; }
  return Object.values(db.log).some(e => e.type === 'done' && e.taskId === q.taskId && e.day === date && !e.deleted) || (t.done && dayKey(t.doneAt) <= date);
}
function checkDailyClear() {
  const p = db.plans[today()]; if (!p || p.bonusClaimed || !p.quests.length) return;
  const st = planStatus(p);
  if (st.done >= st.total) {
    p.bonusClaimed = true; touch(p);
    const xp = +p.bonus?.xp || 50, gold = +p.bonus?.gold || 30;
    logAdd({ id: 'bonus-' + p.date, type: 'bonus', title: 'Daily Quest Cleared', xp, gold, stat: null });
    setTimeout(() => { sfx('level'); popup({ title: 'Daily Quest Cleared', text: 'The daily quest has been completed.', reward: `+${xp} XP · +${gold} G${p.bonus?.text ? '<br>🎁 ' + esc(p.bonus.text) : ''}` }); }, 900);
  }
}
function applyPlan(p, source) {
  if (!p || !p.date) return false;
  const existing = db.plans[p.date];
  if (existing && existing.source !== 'local') return false;
  const norm2 = x => norm(x).replace(/\s+/g, ' ');
  // 1) splits: add subtasks to big tasks
  for (const s of p.splits || []) {
    const t = db.tasks[s.taskId]; if (!t || t.deleted) continue;
    for (const title of s.subtasks || []) {
      const tt = typeof title === 'string' ? title : title.title;
      if (tt && !t.subtasks.some(x => norm2(x.title) === norm2(tt))) t.subtasks.push({ id: uid(), title: tt, done: false });
    }
    if (s.rank && RANKS.includes(s.rank)) t.rank = s.rank;
    if (t.subtasks.length >= 4) t.dungeon = true; // big multi-step task → dungeon
    touch(t);
  }
  // 2) updates (rank/stat/deadline suggestions)
  for (const u of p.updates || []) {
    const t = db.tasks[u.taskId]; if (!t) continue;
    if (u.rank && RANKS.includes(u.rank)) t.rank = u.rank;
    if (u.stat && STATS[u.stat]) t.stat = u.stat;
    touch(t);
  }
  // 3) new tasks the System assigns (e.g. training)
  const refMap = {};
  for (const n of p.newTasks || []) {
    const t = newTask(n.title, { origin: 'ai', rank: RANKS.includes(n.rank) ? n.rank : 'E', stat: STATS[n.stat] ? n.stat : guessStat(n.title), notes: n.notes || '', deadline: n.deadline || '' });
    if (Array.isArray(n.subtasks)) t.subtasks = n.subtasks.map(x => ({ id: uid(), title: String(x), done: false }));
    refMap[n.ref || n.title] = t.id;
  }
  // 4) quests
  const quests = [];
  for (const q of p.quests || []) {
    const taskId = q.taskId && db.tasks[q.taskId] ? q.taskId : refMap[q.newTaskRef || q.ref || q.title];
    const t = db.tasks[taskId]; if (!t || t.deleted) continue;
    let subId = null;
    if (q.subtask) { const st = t.subtasks.find(x => norm2(x.title) === norm2(q.subtask)); subId = st ? st.id : null; if (!st) { const ns = { id: uid(), title: q.subtask, done: false }; t.subtasks.push(ns); subId = ns.id; touch(t); } }
    if (t.nextDay && t.nextDay > p.date) { t.nextDay = ''; touch(t); }
    quests.push({ taskId, subId, xp: clamp(+q.xp || RANK_XP[t.rank], 5, 400), gold: clamp(+q.gold || Math.round(RANK_XP[t.rank] / 2), 0, 300), minutes: +q.minutes || RANK_MIN[t.rank], note: q.note || '' });
  }
  db.plans[p.date] = touch({
    date: p.date, source: source || p.source || 'ai', title: p.title || 'Daily Quest', message: p.message || '',
    quests, bonus: p.bonus || { text: '', xp: 50, gold: 30 }, penalty: p.penalty || { title: 'Penalty Quest: 100 push-ups, no excuses', rank: 'C', stat: 'STR' },
    bonusClaimed: false, penaltyApplied: false, generatedAt: p.generatedAt || new Date().toISOString(), appliedAt: now()
  });
  return true;
}
function scoreTasks() {
  const d = today();
  return liveTasks().filter(isActive).map(t => {
    let score = RANKS.indexOf(t.rank) * 2;
    if (t.deadline) { const days = (Date.parse(t.deadline) - Date.parse(d)) / 864e5; score += days < 0 ? 30 : days <= 1 ? 20 : days <= 3 ? 10 : days <= 7 ? 4 : 0; }
    if (t.pinDay === d) score += 50; if (t.origin === 'penalty') score += 60; if (t.repeat?.type !== 'none') score += 8;
    return { t, score };
  }).sort((a, b) => b.score - a.score);
}
function localPlan() {
  const budget = S().dailyMinutes, max = S().maxQuests;
  const cands = scoreTasks();
  let used = 0; const quests = [];
  for (const { t } of cands) {
    if (quests.length >= max) break;
    const open = t.subtasks.filter(s => !s.done);
    if ((t.rank === 'A' || t.rank === 'S') && open.length) {
      const s = open[0]; const m = 30; if (used + m > budget && quests.length) continue; used += m;
      quests.push({ taskId: t.id, subtask: s.title, xp: 15, gold: 8, minutes: m });
    } else {
      const m = RANK_MIN[t.rank]; if (used + m > budget && quests.length) continue; used += m;
      quests.push({ taskId: t.id, minutes: m });
    }
  }
  return { date: d, title: 'Daily Quest', message: 'The System has assigned your quests for today. Complete them before the day resets.', quests };
}
// ---------- quest control: block / reroll / quick add / focus timer
function questTitle(q) { const t = db.tasks[q.taskId]; if (!t) return '?'; const s = q.subId && t.subtasks.find(x => x.id === q.subId); return s ? s.title : t.title; }
function blockQuest(i, reason) {
  const plan = db.plans[today()]; const q = plan?.quests[i]; if (!q) return;
  q.blocked = true; q.reason = (reason || '').slice(0, 200); touch(plan);
  const t = db.tasks[q.taskId]; if (t) { t.pinDay = ''; touch(t); } // stays in Tasks, just not today's quest
  toast('Returned to Tasks — no penalty'); checkDailyClear(); save();
}
function unblockQuest(i) { const plan = db.plans[today()]; const q = plan?.quests[i]; if (!q) return; q.blocked = false; q.reason = ''; touch(plan); save(); }
function rerollQuest(i) {
  const plan = db.plans[today()]; const q = plan?.quests[i]; if (!q) return;
  const used = new Set(plan.quests.map(x => x.taskId));
  const next = scoreTasks().find(c => !used.has(c.t.id));
  if (!next) return toast('No other task to swap in');
  const t = next.t; const open = t.subtasks.filter(s => !s.done);
  const sub = (t.rank === 'A' || t.rank === 'S') && open.length ? open[0] : null;
  plan.quests[i] = { taskId: t.id, subId: sub ? sub.id : null, xp: sub ? 15 : RANK_XP[t.rank], gold: sub ? 8 : Math.round(RANK_XP[t.rank] / 2), minutes: sub ? 30 : RANK_MIN[t.rank], note: 'swapped in by you' };
  touch(plan); sfx('tick'); save();
}
function addUrgentQuest(title) {
  const t = newTask(title, { origin: 'urgent', pinDay: today() });
  let plan = db.plans[today()];
  if (!plan) { applyPlan({ date: today(), title: 'Daily Quest', message: '', quests: [] }, 'local'); plan = db.plans[today()]; }
  plan.quests.push({ taskId: t.id, subId: null, xp: RANK_XP[t.rank], gold: Math.round(RANK_XP[t.rank] / 2), minutes: RANK_MIN[t.rank], note: 'added by you', added: true });
  touch(plan); sfx('tick'); toast('Added to today'); save();
}
// focus timer (optional — completing a quest never needs it)
const Timer = {
  get() { return LS.get('ss_timer', null); },
  start(taskId, subId) { LS.set('ss_timer', { taskId, subId: subId || null, start: now() }); render(); },
  stop(discard) {
    const t = this.get(); LS.del('ss_timer'); if (!t) return;
    const mins = Math.round((now() - t.start) / 60e3);
    if (!discard && mins >= 1) {
      const task = db.tasks[t.taskId];
      logAdd({ type: 'focus', taskId: t.taskId, subId: t.subId, minutes: mins, title: `Focus: ${task ? task.title : ''}` });
      toast(`⏱ ${mins} min recorded`); save();
    } else render();
  },
  elapsed() { const t = this.get(); return t ? Math.floor((now() - t.start) / 1000) : 0; }
};
function fmtSecs(s) { const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function note(date = today()) { return db.notes?.[date]?.text || ''; }
function setNote(text, date = today()) {
  if (!db.notes) db.notes = {};
  db.notes[date] = touch({ date, text: text.slice(0, 4000) });
  save({ noRender: true });
}
function runDaily() {
  // penalty for yesterday
  const y = addDays(today(), -1), yp = db.plans[y];
  if (yp && !yp.penaltyApplied && yp.quests.length) {
    const st = planStatus(yp);
    yp.penaltyApplied = true; touch(yp);
    if (st.done < st.total && player().inv.shield > 0) {
      logAdd({ type: 'use', key: 'shield', forDay: y, title: 'Streak Shield' });
      setTimeout(() => { sfx('level'); popup({ title: 'Streak Shield Used', text: `Yesterday's daily quest was not cleared (${st.done}/${st.total}).<br>The shield absorbed the penalty.`, reward: 'Streak preserved.' }); }, 600);
    } else if (st.done < st.total) {
      const pen = yp.penalty || {};
      newTask(pen.title || 'Penalty Quest: survive', { origin: 'penalty', rank: RANKS.includes(pen.rank) ? pen.rank : 'C', stat: STATS[pen.stat] ? pen.stat : 'STR', deadline: today(), pinDay: today() });
      setTimeout(() => { sfx('fail'); popup({ cls: 'fail', title: 'Penalty Zone', text: `Yesterday's daily quest was not completed (${st.done}/${st.total}).<br>A penalty quest has been issued.`, reward: esc(pen.title || '') }); }, 600);
    }
    save({ noRender: true });
  }
  // wake repeating tasks whose nextDay arrived
  for (const t of liveTasks()) if (t.nextDay && t.nextDay <= today() && t.done) { t.done = false; touch(t); }
}

// ---------- AI (Haiku)
const PLANNER_SYSTEM = `You are "The System" from Solo Leveling, a strict but motivating daily-quest planner for a single hunter.
You receive JSON with the hunter's open tasks. Produce TODAY's plan as a single JSON object and nothing else.
Rules:
- Pick a manageable set of quests that fits "dailyMinutes" (sum of minutes <= dailyMinutes) and at most "maxQuests" items. Prioritise overdue/near deadlines, pinned tasks, penalty tasks, repeating tasks, then balance stats.
- If a task is big/vague (rank A/S, or would take > 90 min, or has no subtasks and is multi-step), split it into 3-8 concrete subtasks in "splits", and assign only 1-2 of those subtasks as today's quests (use "subtask" with the exact subtask title).
- You may add at most 1 small new task in "newTasks" (e.g. a short training or health quest) only if the list is thin.
- XP guidance: E 10, D 20, C 40, B 70, A 120, S 200; subtask quests 10-40. Gold ≈ XP/2.
- A task's "messageToSystem" is the hunter's instruction for THAT task: follow it when you split it into subtasks and when you decide whether to assign it today.
- OBEY "standingOrders" — they are permanent rules from the hunter. Read "notesFromHunter" (what he wrote during recent days) and treat it as direct feedback to the coach: adjust the load, the schedule and the choice of tasks accordingly, and acknowledge it in one clause of the message.
- "blockedRecently" lists quests he sent back because they were impossible. Do not re-assign a task that is still blocked for the same reason; prefer something he can actually move.
- "recentFocusTimings" are real measured minutes. Use them to make your "minutes" estimates honest.
- "message": 1-3 sentences in the System's voice, referencing the hunter's actual situation (streak, deadlines, yesterday's result, his note). No cringe, no emojis.
- "bonus": reward for clearing all quests; "penalty": a physical or disciplined task if quests are missed (be reasonable).
Output schema:
{"date":"YYYY-MM-DD","title":"Daily Quest: <short theme>","message":"...",
 "splits":[{"taskId":"...","subtasks":["...","..."],"rank":"B"}],
 "updates":[{"taskId":"...","rank":"C","stat":"INT"}],
 "newTasks":[{"ref":"n1","title":"...","rank":"E","stat":"STR"}],
 "quests":[{"taskId":"...","subtask":"optional exact subtask title","newTaskRef":"optional n1","minutes":30,"xp":40,"gold":20,"note":"why today"}],
 "bonus":{"text":"...","xp":60,"gold":40},
 "penalty":{"title":"Penalty Quest: ...","rank":"C","stat":"STR"}}`;

function plannerInput() {
  const p = player(), d = today(), y = addDays(d, -1), yp = db.plans[y];
  const last7 = {}; for (let i = 7; i >= 1; i--) { const k = addDays(d, -i); last7[k] = p.byDay[k] || 0; }
  const notes = {}; for (let i = 0; i <= 3; i++) { const k = addDays(d, -i); if (note(k)) notes[k] = note(k); }
  const focus = Object.values(db.log).filter(e => !e.deleted && e.type === 'focus').slice(-15)
    .map(e => ({ task: db.tasks[e.taskId]?.title || e.title, actualMinutes: e.minutes, day: e.day }));
  const blocked = [];
  for (const k of [d, y, addDays(d, -2), addDays(d, -3)]) for (const q of db.plans[k]?.quests || []) if (q.blocked) blocked.push({ day: k, task: questTitle(q), reason: q.reason || '' });
  return {
    today: d, weekday: DAYS[weekday(d)], dailyMinutes: S().dailyMinutes, maxQuests: S().maxQuests,
    standingOrders: S().standing || '', notesFromHunter: notes, blockedRecently: blocked, recentFocusTimings: focus,
    hunter: { name: S().name, level: p.level, rank: p.hunter, streak: p.streak, stats: p.stats },
    yesterday: yp ? planStatus(yp) : null, completionsLast7Days: last7,
    openTasks: liveTasks().filter(isActive).map(t => ({
      id: t.id, title: t.title, notes: (t.notes || '').slice(0, 300), messageToSystem: t.hint || '', rank: t.rank, stat: t.stat, deadline: t.deadline || null,
      overdue: !!(t.deadline && t.deadline < d), pinnedToday: t.pinDay === d, origin: t.origin, repeat: t.repeat?.type !== 'none' ? repeatLabel(t.repeat) : null,
      subtasks: t.subtasks.map(s => ({ title: s.title, done: s.done }))
    }))
  };
}
async function anthropic(system, user, maxTokens = 2500) {
  const key = await getApiKey(); if (!key) throw new Error('No API key set');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S().model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || ('HTTP ' + r.status));
  return j.content.map(c => c.text || '').join('');
}
function parseJSON(text) { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('No JSON in response'); return JSON.parse(text.slice(a, b + 1)); }

let generating = false;
async function generatePlanHaiku(manual = false) {
  if (generating) return; generating = true; render();
  try {
    if (Drive.ready()) { await sync(); if (db.plans[today()] && db.plans[today()].source !== 'local' && !manual) return; }
    const text = await anthropic(PLANNER_SYSTEM, JSON.stringify(plannerInput()));
    const plan = parseJSON(text); plan.date = today(); plan.source = 'haiku'; plan.generatedAt = new Date().toISOString();
    if (manual && db.plans[today()]) { delete db.plans[today()]; }
    applyPlan(plan, 'haiku');
    if (Drive.ready()) { try { await Drive.writePlanFile(plan); } catch (e) { console.warn(e); } }
    sfx('level'); popup({ title: 'Daily Quest Arrived', text: esc(plan.message || 'New quests assigned.') });
    save();
  } catch (e) { toast('Haiku failed: ' + e.message, 5000); }
  finally { generating = false; render(); }
}
async function maybeAutoPlan() {
  const d = today();
  if (db.plans[d]) return;
  const canHaiku = S().autoHaiku && db.security?.apiKey && hourInDay() >= S().fallbackHour && LS.get('ss_haiku_try') !== d;
  if (canHaiku && (!Drive.configured() || Drive.ready())) { LS.set('ss_haiku_try', d); await generatePlanHaiku(); }
}
async function splitWithAI(t) {
  const txt = await anthropic('Split the task into 3-8 concrete, ordered, actionable subtasks (each doable in under 60 minutes). Follow "messageToSystem" if present — it is the owner\'s instruction for this task. Reply ONLY with JSON: {"subtasks":["..."],"rank":"E|D|C|B|A|S"}',
    JSON.stringify({ title: t.title, notes: t.notes, messageToSystem: t.hint || '', deadline: t.deadline, existingSubtasks: t.subtasks.map(s => s.title) }), 800);
  return parseJSON(txt);
}
async function getApiKey() {
  if (apiKeyCache) return apiKeyCache;
  if (!db.security?.apiKey || !cryptoKey) return null;
  apiKeyCache = await decStr(cryptoKey, db.security.apiKey); return apiKeyCache;
}

// ---------- Google Drive
const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER = 'SoloSystem', DBFILE = 'system-db.json';
const Drive = {
  token: LS.get('ss_tok', null), client: null, folderId: LS.get('ss_folder', null), fileId: LS.get('ss_fileid', null), pending: null,
  clientId() { return LS.get('ss_client_id', '') || (window.SS_CONFIG || {}).googleClientId || ''; },
  configured() { return !!this.clientId() && LS.get('ss_drive_on', false); },
  ready() { return this.configured() && this.token && this.token.exp > now() + 60e3; },
  init() {
    if (this.client || !this.clientId() || !window.google?.accounts?.oauth2) return !!this.client;
    this.client = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId(), scope: SCOPE,
      callback: r => {
        const p = this.pending; this.pending = null;
        if (r.error) return p?.rej(new Error(r.error));
        this.token = { v: r.access_token, exp: now() + (r.expires_in - 60) * 1000 };
        LS.set('ss_tok', this.token); syncErr = ''; this.scheduleRefresh();
        this.whoami();
        p?.res(this.token);
      },
      error_callback: e => { const p = this.pending; this.pending = null; p?.rej(new Error(e.type || 'popup closed')); }
    });
    return true;
  },
  // must be called from a user gesture (click) for the popup to open
  connect(prompt = '') {
    if (!this.init()) return Promise.reject(new Error('Google script not loaded or no Client ID'));
    if (this.pending) return new Promise((res, rej) => { const p = this.pending; this.pending = { res: v => { p.res(v); res(v); }, rej: e => { p.rej(e); rej(e); } }; });
    return new Promise((res, rej) => {
      this.pending = { res, rej };
      const hint = LS.get('ss_email', '');
      try { this.client.requestAccessToken(hint ? { prompt, hint } : { prompt }); } catch (e) { this.pending = null; rej(e); }
      setTimeout(() => { if (this.pending) { this.pending.rej(new Error('sign-in timed out')); this.pending = null; } }, 90e3);
    });
  },
  // keeps the hour-long token alive while the app is open; silent (no consent screen)
  silent() {
    if (!this.configured() || this.ready()) return Promise.resolve();
    if (now() - (this.lastSilent || 0) < 20e3) return Promise.reject(new Error('cooling down'));
    this.lastSilent = now();
    return this.connect('');
  },
  scheduleRefresh() {
    clearTimeout(this._rt);
    if (!this.token) return;
    const ms = Math.max(30e3, this.token.exp - now() - 5 * 60e3);
    this._rt = setTimeout(() => { if (document.visibilityState === 'visible') this.silent().then(() => sync()).catch(() => renderSync()); }, ms);
  },
  async api(url, opts = {}) {
    if (!this.ready()) throw new Error('not connected');
    const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opts, headers: { Authorization: 'Bearer ' + this.token.v, ...(opts.headers || {}) } });
    if (r.status === 401) { this.token = null; LS.del('ss_tok'); throw new Error('token expired'); }
    if (!r.ok) throw new Error('Drive ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r;
  },
  async q(query, fields = 'files(id,name,mimeType,modifiedTime)') {
    const r = await this.api('files?' + new URLSearchParams({ q: query, fields, spaces: 'drive', pageSize: '50', orderBy: 'modifiedTime desc' }));
    return (await r.json()).files || [];
  },
  async ensureFolder() {
    if (this.folderId) return this.folderId;
    const f = await this.q(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    if (f[0]) this.folderId = f[0].id;
    else { const r = await this.api('files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) }); this.folderId = (await r.json()).id; }
    LS.set('ss_folder', this.folderId); return this.folderId;
  },
  async readText(file) {
    if (file.mimeType === 'application/vnd.google-apps.document') return (await this.api(`files/${file.id}/export?mimeType=text/plain`)).text();
    return (await this.api(`files/${file.id}?alt=media`)).text();
  },
  async upsert(name, content, fileId) {
    if (fileId) {
      await this.api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content });
      return fileId;
    }
    const folder = await this.ensureFolder(); const boundary = 'ss' + uid();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folder], mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
    return (await r.json()).id;
  },
  async findDbFile() {
    const folder = await this.ensureFolder();
    const f = await this.q(`name='${DBFILE}' and '${folder}' in parents and trashed=false`);
    if (f[0]) { this.fileId = f[0].id; LS.set('ss_fileid', this.fileId); }
    else { this.fileId = null; LS.del('ss_fileid'); }
    return f[0] || null;
  },
  async whoami() { try { const r = await this.api('about?fields=user(emailAddress)'); const m = (await r.json())?.user?.emailAddress; if (m) LS.set('ss_email', m); } catch { } },
  async planFiles() { return this.q(`name contains 'ai-plan-' and trashed=false`); },
  async writePlanFile(plan) {
    const name = `ai-plan-${plan.date}.json`;
    const ex = (await this.planFiles()).find(f => f.name.startsWith(name.replace('.json', '')));
    if (ex) return;
    await this.upsert(name, JSON.stringify(plan, null, 2));
  }
};

let syncing = false, syncTimer = null, lastSync = LS.get('ss_last_sync', 0), syncErr = '', syncFails = 0, syncQueued = false;
function dirty() { return LS.get('ss_dirty', false); }
function scheduleSync(ms) { clearTimeout(syncTimer); if (Drive.configured()) syncTimer = setTimeout(() => sync(), ms); }
async function sync(opts = {}) {
  if (!cryptoKey || !Drive.configured()) { renderSync(); return; }
  if (syncing) { syncQueued = true; return; }
  if (!Drive.ready()) {
    // token died (they last about an hour) — try to renew it without bothering the user
    try { await Drive.silent(); } catch (e) { syncErr = 'reconnect needed'; renderSync(); return; }
  }
  syncing = true; renderSync();
  try {
    const file = await Drive.findDbFile();
    let remote = null, remoteStr = '';
    if (file) { remoteStr = await Drive.readText(file); try { remote = JSON.parse(remoteStr); } catch { remote = null; } }
    db = mergeDB(db, remote);
    // import AI plan files (Claude scheduled task or Haiku from another device)
    const d = today(), y = addDays(d, -1);
    for (const f of await Drive.planFiles()) {
      const m = f.name.match(/ai-plan-(\d{4}-\d{2}-\d{2})/); if (!m) continue;
      const date = m[1]; if (date !== d && date !== y) continue;
      if (db.plans[date] && db.plans[date].source !== 'local') continue;
      try { const p = parseJSON(await Drive.readText(f)); p.date = date; if (applyPlan(p, p.source || 'claude') && date === d) { sfx('level'); popup({ title: 'Daily Quest Arrived', text: esc(p.message || 'New quests assigned.') }); } } catch (e) { console.warn('bad plan file', f.name, e); }
    }
    runDaily();
    const out = stableDB(db);
    if (out !== remoteStr) Drive.fileId = await Drive.upsert(DBFILE, out, file ? file.id : null);
    LS.set('ss_fileid', Drive.fileId);
    LS.set('ss_dirty', false); lastSync = now(); LS.set('ss_last_sync', lastSync); syncErr = ''; syncFails = 0;
    persistLocal();
  } catch (e) {
    syncErr = e.message; syncFails++; console.warn(e);
    if (syncFails < 6) scheduleSync(Math.min(60e3, 3e3 * syncFails)); // keep retrying quietly, nothing is lost
  }
  finally { syncing = false; render(); }
  if (syncQueued) { syncQueued = false; scheduleSync(800); }
  maybeAutoPlan();
}
// last-chance flush when the app is closed or backgrounded
function flushSync() {
  if (!cryptoKey) return;
  persistLocal();
  if (dirty() && Drive.ready()) sync();
}

// ---------- sound & popups
let actx = null;
function sfx(kind) {
  if (!S().sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { done: [660, 880], tick: [880], level: [523, 659, 784, 1046], fail: [220, 165] }[kind] || [660];
    seq.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = kind === 'fail' ? 'sawtooth' : 'sine'; o.frequency.value = f;
      const t = actx.currentTime + i * 0.09; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .35);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .4);
    });
  } catch { }
}
function popup({ title, text = '', reward = '', cls = '' }) {
  const el = document.createElement('div'); el.className = 'popup ' + cls;
  el.innerHTML = `<div class="sys-window"><div class="sys-head"><span class="sys-icon">!</span>NOTIFICATION</div><div class="sys-body"><div class="p-title">[${esc(title)}]</div><div class="p-text">${text}</div>${reward ? `<div class="p-reward">${reward}</div>` : ''}<div style="margin-top:14px"><button class="btn small">Confirm</button></div></div></div>`;
  el.querySelector('button').onclick = () => el.remove();
  $('#popups').appendChild(el); setTimeout(() => el.remove(), 7000);
}
let toastT; function toast(msg, ms = 2200) { const t = $('#toast'); t.innerHTML = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

// ---------- LOCK SCREEN
async function tryRememberedKey() {
  const k = await IDB.get('key'); const sec = LS.get('ss_security', null);
  if (!k || !sec?.verifier) return false;
  try { if (await decStr(k, sec.verifier) !== VERIFIER) return false; cryptoKey = k; db.security = sec; await loadLocal(); return true; } catch { return false; }
}
async function loadLocal() {
  const enc = LS.get('ss_db_enc', null);
  if (enc) { try { db = mergeDB(emptyDB(), JSON.parse(await decStr(cryptoKey, enc))); } catch (e) { console.warn('local decrypt failed', e); } }
}
function renderLock(mode, msg = '') {
  const sec = LS.get('ss_security', null) || (db.security?.verifier ? db.security : null);
  const body = $('#lockBody'); const cid = Drive.clientId();
  if (!mode) mode = sec?.verifier ? 'unlock' : 'setup';
  if (mode === 'unlock') {
    body.innerHTML = `<div class="sys-body"><p class="big-q">Identity verification required.</p>
      <input id="pw" type="password" placeholder="Password" autocomplete="current-password">
      <label class="row" style="text-transform:none;letter-spacing:0;font-size:15px"><input id="rem" type="checkbox" ${LS.get('ss_remember', false) ? 'checked' : ''}> Remember this device</label>
      <div class="err" id="lerr">${esc(msg)}</div>
      <button class="btn primary block" id="unlockBtn">Accept</button></div>`;
    const go = async () => {
      const pw = $('#pw').value; if (!pw) return;
      $('#unlockBtn').innerHTML = '<span class="spin">◌</span>';
      const wantDrive = Drive.configured() && !Drive.ready();
      const drivePromise = wantDrive ? Drive.connect('').catch(e => { syncErr = e.message; }) : null; // gesture → popup allowed
      try {
        const key = await deriveKey(pw, sec.salt);
        if (await decStr(key, sec.verifier) !== VERIFIER) throw 0;
        cryptoKey = key; db.security = sec;
        const rem = $('#rem').checked; LS.set('ss_remember', rem);
        if (rem) await IDB.set('key', key); else await IDB.del('key');
        await loadLocal(); if (!db.security?.verifier) db.security = sec;
        enterApp(); if (drivePromise) drivePromise.then(() => sync()); else if (Drive.ready()) sync();
      } catch { $('#lerr').textContent = 'Access denied. Incorrect password.'; $('#unlockBtn').textContent = 'Accept'; sfx('fail'); }
    };
    $('#unlockBtn').onclick = go; $('#pw').onkeydown = e => e.key === 'Enter' && go(); setTimeout(() => $('#pw')?.focus(), 50);
    return;
  }
  // setup (first launch on this device)
  body.innerHTML = `<div class="sys-body">
    <p class="big-q">You have acquired the qualifications to be a <b>Player</b>.<br>Will you accept?</p>
    <label>Google OAuth Client ID (for Drive sync)</label>
    <input id="cid" placeholder="xxxx.apps.googleusercontent.com" value="${esc(cid)}">
    <div class="row" style="margin-top:10px"><button class="btn block" id="restoreBtn">Restore from Google Drive</button></div>
    <hr><p class="muted" style="margin:0 0 8px">New player? Create your password. It encrypts your API key and this device's data. It cannot be recovered.</p>
    <input id="pw1" type="password" placeholder="New password" autocomplete="new-password">
    <div style="height:8px"></div><input id="pw2" type="password" placeholder="Repeat password" autocomplete="new-password">
    <div class="err" id="lerr">${esc(msg)}</div>
    <div class="row"><button class="btn ghost" id="skipDrive">Local only</button><button class="btn primary grow" id="createBtn">Accept</button></div></div>`;
  const saveCid = () => { const v = $('#cid').value.trim(); LS.set('ss_client_id', v); Drive.client = null; return v; };
  $('#restoreBtn').onclick = async () => {
    if (!saveCid()) return $('#lerr').textContent = 'Enter the Client ID first.';
    try {
      LS.set('ss_drive_on', true); await Drive.connect('consent');
      const f = await Drive.findDbFile(); if (!f) return $('#lerr').textContent = 'No system-db.json found in Drive. Create a new player instead.';
      const remote = JSON.parse(await Drive.readText(f));
      if (!remote.security?.verifier) return $('#lerr').textContent = 'Drive data has no password set.';
      db = mergeDB(emptyDB(), remote); LS.set('ss_security', remote.security); renderLock('unlock', 'Data found. Enter your password.');
    } catch (e) { $('#lerr').textContent = 'Drive: ' + e.message; }
  };
  const create = async (withDrive) => {
    const a = $('#pw1').value, b = $('#pw2').value;
    if (a.length < 6) return $('#lerr').textContent = 'Password must be at least 6 characters.';
    if (a !== b) return $('#lerr').textContent = 'Passwords do not match.';
    const cidv = saveCid(); withDrive = withDrive && !!cidv;
    if (withDrive) {
      LS.set('ss_drive_on', true);
      try {
        await Drive.connect('consent'); // first statement → still inside the click gesture
        if (await Drive.findDbFile()) return $('#lerr').textContent = 'Your Drive already has System data. Press "Restore from Google Drive" instead.';
      } catch (e) { LS.set('ss_drive_on', false); return $('#lerr').textContent = 'Google: ' + e.message + ' (or use Local only)'; }
    } else LS.set('ss_drive_on', false);
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    cryptoKey = await deriveKey(a, salt);
    db = emptyDB(); db.security = { salt, verifier: await encStr(cryptoKey, VERIFIER), apiKey: null, updatedAt: now() };
    LS.set('ss_security', db.security);
    seedTasks(); persistLocal(); enterApp();
    sfx('level'); popup({ title: 'Welcome, Player', text: 'The System has been installed.<br>Add your tasks. The System will assign daily quests.', reward: 'Reward: [Status window] unlocked' });
    if (withDrive) sync();
  };
  $('#createBtn').onclick = () => create(true);
  $('#skipDrive').onclick = () => create(false);
}
function seedTasks() {
  newTask('Drink 2L of water', { rank: 'E', stat: 'VIT', repeat: { type: 'daily', every: 1, days: [] } });
  newTask('Workout: 20 push-ups, 20 squats, 1 km run', { rank: 'D', stat: 'STR', repeat: { type: 'daily', every: 1, days: [] } });
}
function enterApp() {
  $('#lock').classList.add('hidden'); $('#app').classList.remove('hidden');
  history.replaceState({ tab }, '');
  runDaily(); render(); Drive.scheduleRefresh(); maybeAutoPlan();
}
function lockNow() { cryptoKey = null; apiKeyCache = null; IDB.del('key'); db = emptyDB(); $('#app').classList.add('hidden'); $('#lock').classList.remove('hidden'); renderLock(); }

// ---------- RENDER
function render() {
  if (!cryptoKey) return;
  const p = player();
  $('#lvlChip').textContent = `LV.${p.level}`; $('#goldChip').textContent = `${p.gold} G`;
  renderSync();
  $$('.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  const fn = { quests: viewQuests, tasks: viewTasks, status: viewStatus, log: viewLog, shop: viewShop, settings: viewSettings }[tab] || viewQuests;
  const focusId = document.activeElement?.id, val = document.activeElement?.value;
  v.innerHTML = fn(p);
  bind(v);
  if (focusId && $('#' + focusId)) { const el = $('#' + focusId); el.focus(); if (val != null && el.value === '') el.value = val; }
}
function renderSync() {
  const b = $('#syncBtn'); if (!b) return;
  b.className = 'sync-btn';
  if (!Drive.configured()) { b.textContent = 'local'; return; }
  if (syncing) { b.innerHTML = '<span class="spin">⟳</span> syncing'; return; }
  if (!Drive.ready()) { b.textContent = dirty() ? '⟳ saved here · tap' : '⟳ reconnect'; b.classList.add('warn'); return; }
  if (syncErr) { b.textContent = '⚠ ' + syncErr; b.classList.add('warn'); return; }
  if (dirty()) { b.innerHTML = '<span class="spin">⟳</span> saving'; return; }
  b.textContent = '✓ ' + (lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ready'); b.classList.add('ok');
}
function rankBadge(r) { return `<span class="rank ${r}">${r}</span>`; }
function countdown() { const ms = dayEndTs(today()) - now(); const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1e3); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

function viewQuests(p) {
  const d = today(), plan = db.plans[d];
  let h = `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">!</span>QUEST INFO</div><div class="sys-body">`;
  if (!plan) {
    const hasKey = !!db.security?.apiKey;
    h += `<div class="quest-title">DAILY QUEST</div><div class="quest-sub">${esc(fmtDay(d))} · ${DAYS[weekday(d)]}</div>
      <div class="sys-msg">${generating ? '<span class="spin">◌</span> The System is analysing your tasks…' : 'No quest has been issued yet. Claude plans at 04:00; if it hasn\'t, Haiku takes over after ' + String(S().fallbackHour).padStart(2, '0') + ':00.'}</div>
      <div class="row wrap">${hasKey ? `<button class="btn primary grow" data-act="genHaiku" ${generating ? 'disabled' : ''}>⚡ Summon quest (Haiku)</button>` : ''}
      <button class="btn grow" data-act="genLocal">Auto-pick (no AI)</button>${Drive.configured() ? `<button class="btn" data-act="sync">⟳ Check Drive</button>` : ''}</div>`;
  } else {
    const st = planStatus(plan);
    h += `<div class="quest-title">${esc(plan.title || 'DAILY QUEST')}</div>
      <div class="quest-sub">${esc(fmtDay(d))} · issued by ${esc(plan.source)}</div>
      ${plan.message ? `<div class="sys-msg">${esc(plan.message)}</div>` : ''}
      <div class="section-title" style="margin-top:6px">GOALS <span>${st.done}/${st.total}</span></div>`;
    if (!plan.quests.length) h += `<div class="empty">No quests today. Rest is also training.</div>`;
    const tm = Timer.get();
    for (const [i, q] of plan.quests.entries()) {
      const t = db.tasks[q.taskId]; if (!t) continue;
      if (q.blocked) continue;
      const s = q.subId ? t.subtasks.find(x => x.id === q.subId) : null; const dn = questDone(q, d);
      const running = tm && tm.taskId === q.taskId && (tm.subId || null) === (q.subId || null);
      h += `<div class="goal ${dn ? 'done' : ''}"><input type="checkbox" class="chk" data-act="quest" data-i="${i}" ${dn ? 'checked' : ''} ${q.skipped ? 'disabled' : ''}>
        <div class="gname"><span>${esc(s ? s.title : t.title)}</span>${s ? `<small>↳ ${esc(t.title)}</small>` : ''}${q.note ? `<small>${esc(q.note)}</small>` : ''}${q.skipped ? '<small style="color:var(--gold)">skipped with a token</small>' : ''}
          ${running ? `<small class="focus-live">⏱ <span id="focusT">${fmtSecs(Timer.elapsed())}</span> — <a href="#" data-act="timerStop" data-i="${i}">stop &amp; record</a></small>` : ''}</div>
        ${!dn ? `<div class="qtools">
          ${!running && !tm ? `<button class="icon-btn" data-act="timerStart" data-i="${i}" title="Start focus timer (optional)">▶</button>` : ''}
          <button class="icon-btn" data-act="reroll" data-i="${i}" title="Swap for another task">⟳</button>
          <button class="icon-btn" data-act="block" data-i="${i}" title="Blocked — send back to Tasks">⤺</button>
          ${p.inv.skip ? `<button class="icon-btn" data-act="skipQuest" data-i="${i}" title="Skip with a token">⏭</button>` : ''}
        </div>` : ''}
        <div class="reward-line">${rankBadge(t.rank)}<br>+${q.xp} XP<br><span class="muted">${q.minutes}m</span></div></div>`;
    }
    const blocked = plan.quests.map((q, i) => ({ q, i })).filter(x => x.q.blocked);
    if (blocked.length) h += `<div class="blocked-box"><b>Returned to Tasks</b>${blocked.map(({ q, i }) => `<div class="row" style="margin-top:4px"><span class="grow">⤺ ${esc(questTitle(q))}${q.reason ? ` <span class="muted">— ${esc(q.reason)}</span>` : ''}</span><button class="icon-btn" data-act="unblock" data-i="${i}" title="Put it back on today">↩</button></div>`).join('')}</div>`;
    h += `<div class="progress"><div style="width:${st.total ? st.done / st.total * 100 : 0}%"></div></div>`;
    if (plan.bonus?.text || plan.bonus?.xp) h += `<div class="bonus-box">${plan.bonusClaimed ? '✓ CLEARED — ' : 'CLEAR REWARD: '}+${plan.bonus.xp || 50} XP · +${plan.bonus.gold || 30} G${plan.bonus.text ? ' · ' + esc(plan.bonus.text) : ''}</div>`;
    if (!plan.bonusClaimed) h += `<div class="warn-box"><b>WARNING:</b> Failure to complete the daily quest will result in an appropriate penalty.<br><span class="muted">${esc(plan.penalty?.title || '')}</span></div>`;
    h += `<div class="timer" id="timer">⏱ ${countdown()}</div>`;
  }
  h += `<div class="add-row" style="margin-top:14px"><input id="quickQuest" placeholder="Something urgent came up…" enterkeyhint="done" autocomplete="off"><button class="btn primary" data-act="addQuest">+</button></div>
    <p class="muted" style="font-size:12px;margin:6px 0 0">Added here it becomes a quest for today and lands in Tasks.</p>`;
  h += `</div></div>`;
  // note to the System
  h += `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">✎</span>NOTE TO THE SYSTEM</div><div class="sys-body">
    <p class="muted" style="margin:0 0 8px;font-size:14px">Write anything the coach should know — it's read when the next plan is made. <span id="noteSaved" class="muted"></span></p>
    <textarea id="noteBox" rows="3" placeholder="e.g. exam moved to Friday · sick today, go easy · the API task is blocked by the client">${esc(note())}</textarea>
    ${S().standing ? `<p class="muted" style="font-size:13px;margin:8px 0 0">Standing orders: ${esc(S().standing)}</p>` : ''}</div></div>`;
  // penalty + pinned + overdue quick list
  const urgent = liveTasks().filter(t => isActive(t) && (t.origin === 'penalty' || (t.deadline && t.deadline <= d)) && !(plan?.quests || []).some(q => q.taskId === t.id));
  if (urgent.length) { h += `<div class="section-title">URGENT</div>` + urgent.map(taskRow).join(''); }
  if (plan) h += `<div class="row" style="justify-content:center;margin-top:10px">${db.security?.apiKey ? `<button class="btn small ghost" data-act="regen">↻ Re-plan with Haiku (1 request)</button>` : `<button class="btn small ghost" data-act="genLocalForce">↻ Re-pick (no AI)</button>`}</div>`;
  return h;
}
function taskRow(t) {
  const d = today(); const subDone = t.subtasks.filter(s => s.done).length;
  const meta = [];
  if (t.deadline) meta.push(`<span class="${t.deadline < d && !t.done ? 'over' : ''}">⌛ ${esc(fmtDay(t.deadline))}</span>`);
  if (t.subtasks.length) meta.push(`<span>☰ ${subDone}/${t.subtasks.length}</span>`);
  if (t.repeat?.type !== 'none') meta.push(`<span>${esc(repeatLabel(t.repeat))}</span>`);
  if (t.nextDay && t.nextDay > d) meta.push(`<span>next ${esc(fmtDay(t.nextDay))}</span>`);
  if (t.reward?.text) meta.push(`<span>🎁 ${esc(t.reward.text)}</span>`);
  if (db.plans[d]?.quests.some(q => q.taskId === t.id)) meta.push(`<span class="today">◈ quest</span>`);
  if (t.origin === 'penalty') meta.push(`<span class="over">penalty</span>`);
  meta.push(`<span>${t.stat}</span>`);
  if (t.hint) meta.push(`<span class="hint-chip">💬 ${esc(t.hint)}</span>`);
  return `<div class="task ${t.done ? 'done' : ''}">
    <input type="checkbox" class="chk" data-act="toggle" data-id="${t.id}" ${t.done ? 'checked' : ''}>
    <div class="tbody"><div class="tt">${esc(t.title)}</div><div class="meta">${meta.join('')}</div></div>
    ${rankBadge(t.rank)}
    ${!t.done ? `<button class="icon-btn ${t.hint ? 'on' : ''}" data-act="hint" data-id="${t.id}" title="Message to the System">💬</button>` : ''}
    ${!t.done ? `<button class="icon-btn ${t.pinDay === d ? 'on' : ''}" data-act="pin" data-id="${t.id}" title="Pin to today">★</button>` : ''}
    <button class="icon-btn" data-act="edit" data-id="${t.id}" title="Edit">✎</button></div>`;
}
function dungeonCard(t) {
  const done = t.subtasks.filter(s => s.done).length, total = t.subtasks.length || 1;
  const pct = Math.round(done / total * 100);
  return `<div class="dungeon ${t.rank}">
    <div class="row"><span class="rank ${t.rank}">${t.rank}</span><div class="grow"><b>${esc(t.title)}</b>
      <div class="muted" style="font-size:13px">${done}/${t.subtasks.length} cleared${t.deadline ? ' · ⌛ ' + esc(fmtDay(t.deadline)) : ''}</div></div>
      <button class="icon-btn" data-act="edit" data-id="${t.id}">✎</button></div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <div class="row" style="margin-top:8px"><span class="muted" style="font-size:13px">⚔ Dungeon — medal on clear</span><span class="grow"></span>
    ${done >= t.subtasks.length && t.subtasks.length ? `<button class="btn small primary" data-act="toggle" data-id="${t.id}">Claim medal</button>` : ''}</div></div>`;
}
function viewTasks() {
  const all = liveTasks();
  const dungeons = all.filter(t => t.dungeon && isActive(t));
  const order = (a, b) => (a.deadline || '9999') .localeCompare(b.deadline || '9999') || RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || a.createdAt - b.createdAt;
  const active = all.filter(t => isActive(t) && !t.dungeon).sort(order), sched = all.filter(isScheduled).sort((a, b) => a.nextDay.localeCompare(b.nextDay)), done = all.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
  let h = `<div class="add-row"><input id="newTask" placeholder="What must be done?" enterkeyhint="done" autocomplete="off"><button class="btn primary" data-act="add">+</button></div>`;
  if (dungeons.length) h += `<div class="section-title">DUNGEONS <span>${dungeons.length}</span></div>` + dungeons.map(dungeonCard).join('');
  h += `<div class="section-title">ACTIVE <span>${active.length}</span></div>`;
  h += active.length ? active.map(taskRow).join('') : `<div class="empty">No tasks. Write what you have to do above.</div>`;
  if (sched.length) { h += `<div class="section-title toggle" data-act="tgSched">SCHEDULED <span>${sched.length} ${ui.showSched ? '▾' : '▸'}</span></div>`; if (ui.showSched) h += sched.map(taskRow).join(''); }
  if (done.length) { h += `<div class="section-title toggle" data-act="tgDone">COMPLETED <span>${done.length} ${ui.showDone ? '▾' : '▸'}</span></div>`; if (ui.showDone) h += done.slice(0, 60).map(taskRow).join(''); }
  return h;
}
function viewStatus(p) {
  const title = TITLES.find(t => t.id === S().title && t.test(p));
  let h = `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">◉</span>STATUS</div><div class="sys-body">
    <div class="player"><div class="lvl-big">${p.level}<small>LEVEL</small></div>
    <div class="kv"><b>Name</b><span>${esc(S().name)}</span><b>Rank</b><span>${p.hunter}-Rank Hunter${p.awakenings ? ` <span style="color:var(--purple)">✦${p.awakenings}</span>` : ''}</span><b>Title</b><span>${title ? esc(title.name) : '<span class="muted">none</span>'}</span><b>Streak</b><span>${p.streak} day${p.streak === 1 ? '' : 's'} (best ${p.bestStreak})</span><b>Gold</b><span style="color:var(--gold)">${p.gold} G</span>${p.awakenings ? `<b>Bonus</b><span style="color:var(--purple)">+${Math.round(p.awakenings * AWAKEN_BONUS * 100)}% EXP</span>` : ''}${p.potionActive ? `<b>Buff</b><span style="color:var(--green)">⚗ Double EXP today</span>` : ''}</div></div>
    <div class="section-title">EXP <span>${p.cur} / ${p.need}</span></div><div class="progress xp"><div style="width:${p.cur / p.need * 100}%"></div></div>
    ${p.level >= AWAKEN_LEVEL ? `<div class="bonus-box" style="border-color:var(--purple);color:#d9c2ff">You have reached the limit of this body. <b>Awakening</b> resets your level to 1 but keeps every stat, medal, title and coin — and grants a permanent +${Math.round((p.awakenings + 1) * AWAKEN_BONUS * 100)}% EXP.<div style="margin-top:8px"><button class="btn small" data-act="awaken">✦ Awaken</button></div></div>` : `<p class="muted" style="font-size:13px;margin:6px 0 0">Awakening unlocks at level ${AWAKEN_LEVEL} — levels never cap.</p>`}
    <div class="section-title">STATS</div>`;
  const maxStat = Math.max(30, ...Object.values(p.stats));
  for (const [k, v] of Object.entries(p.stats)) h += `<div class="stat" title="${esc(STAT_HINT[k])}"><span class="sn">${k}</span><div class="progress"><div style="width:${v / maxStat * 100}%"></div></div><span class="sv">${v}</span></div>`;
  h += `<p class="muted" style="font-size:13px;margin:4px 0 0">${Object.entries(STAT_HINT).map(([k, v]) => `<b>${k}</b> ${v}`).join(' · ')}</p></div></div>`;
  // 7 day bars
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const mx = Math.max(1, ...days.map(d => p.byDay[d] || 0));
  h += `<div class="sys-window card"><div class="sys-head">LAST 7 DAYS</div><div class="sys-body"><div class="bars">${days.map(d => `<div class="b"><span>${p.byDay[d] || 0}</span><i style="height:${(p.byDay[d] || 0) / mx * 70}px"></i><span>${DAYS[weekday(d)]}</span></div>`).join('')}</div>
    <p class="muted" style="font-size:14px;margin:10px 0 0">Tasks cleared: <b>${p.doneCount}</b> · Daily quests cleared: <b>${p.dailyClears}</b> · Total EXP: <b>${p.xp}</b></p></div></div>`;
  h += `<div class="sys-window card"><div class="sys-head">TITLES</div><div class="sys-body"><div class="titles">${TITLES.map(t => { const ok = t.test(p); return `<button class="title-badge ${ok ? '' : 'locked'} ${S().title === t.id && ok ? 'eq' : ''}" data-act="equip" data-id="${t.id}" ${ok ? '' : 'disabled'}>${esc(t.name)}<small>${esc(t.desc)}</small></button>`; }).join('')}</div></div></div>`;
  // medals
  h += `<div class="sys-window card"><div class="sys-head">MEDALS <span style="margin-left:auto;color:var(--muted);font-size:12px">${p.medals.length}</span></div><div class="sys-body">`;
  h += p.medals.length ? `<div class="medals">${p.medals.slice().reverse().map(m => `<div class="medal ${m.rank}"><div class="mdisc">${m.rank}</div><div><b>${esc(m.name)}</b><small class="muted">${esc(fmtDay(m.day))}</small></div></div>`).join('')}</div>`
    : `<div class="empty">No medals yet. Clear a dungeon to earn one.</div>`;
  h += `</div></div>`;
  // shadow army
  const byRank = {}; p.shadows.forEach(s => byRank[s.rank] = (byRank[s.rank] || 0) + 1);
  const shown = p.shadows.slice().reverse().slice(0, ui.allShadows ? 400 : 24);
  h += `<div class="sys-window card"><div class="sys-head">SHADOW ARMY <span style="margin-left:auto;color:var(--muted);font-size:12px">${p.shadows.length}</span></div><div class="sys-body">
    <p class="muted" style="margin-top:0;font-size:14px">Every task you finish rises as a shadow. ${RANKS.slice().reverse().filter(r => byRank[r]).map(r => `<span class="rank ${r}" style="display:inline-grid">${r}</span>×${byRank[r]}`).join(' ')}</p>
    ${p.shadows.length ? `<div class="shadows">${shown.map(s => `<div class="shadow ${s.rank}" title="${esc(s.name)} · ${esc(s.day)}"><span>${esc(s.name)}</span></div>`).join('')}</div>
    ${p.shadows.length > 24 ? `<button class="btn small ghost" data-act="tgShadows" style="margin-top:8px">${ui.allShadows ? 'Show less' : 'Show all ' + p.shadows.length}</button>` : ''}`
      : `<div class="empty">Your army is empty. Arise.</div>`}
  </div></div>`;
  return h;
}
function viewLog(p) {
  const month = ui.calMonth || today().slice(0, 7);
  const first = month + '-01', firstW = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7; // week starts Monday
  const daysIn = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstW; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  const maxXp = Math.max(60, ...Object.values(p.xpByDay));
  const [y, m] = [+month.slice(0, 4), +month.slice(5, 7)];
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  let h = `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">▦</span>RECORD</div><div class="sys-body">
    <div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="icon-btn" data-act="cal" data-id="${prev}">‹</button>
      <b style="font-family:Orbitron;letter-spacing:.1em">${MONTHS[m - 1]} ${y}</b>
      <button class="icon-btn" data-act="cal" data-id="${next}" ${next > today().slice(0, 7) ? 'disabled' : ''}>›</button></div>
    <div class="cal">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="cal-h">${d}</div>`).join('')}`;
  for (const c of cells) {
    if (!c) { h += `<div></div>`; continue; }
    const xp = p.xpByDay[c] || 0, plan = db.plans[c], st = plan ? planStatus(plan) : null;
    const cleared = plan && plan.bonusClaimed, failed = plan && c < today() && st.done < st.total && !p.shieldDays.has(c);
    const a = xp ? 0.15 + 0.85 * Math.min(1, xp / maxXp) : 0;
    h += `<button class="cal-d ${c === today() ? 'today' : ''} ${ui.calDay === c ? 'sel' : ''} ${cleared ? 'cleared' : ''} ${failed ? 'failed' : ''}" data-act="calday" data-id="${c}" style="--a:${a}">
      <span>${+c.slice(8)}</span>${xp ? `<i>${xp}</i>` : ''}</button>`;
  }
  h += `</div><div class="cal-legend muted"><span class="lg cleared"></span>daily quest cleared <span class="lg failed"></span>failed <span class="lg xp"></span>EXP earned</div></div></div>`;
  const d = ui.calDay;
  if (d) {
    const plan = db.plans[d];
    const entries = Object.values(db.log).filter(e => !e.deleted && e.day === d).sort((a, b) => a.at - b.at);
    h += `<div class="sys-window card"><div class="sys-head">${esc(fmtDay(d))} <span style="margin-left:auto;font-size:12px;color:var(--muted)">${d}</span></div><div class="sys-body">`;
    if (plan) {
      const st = planStatus(plan); const blocked = plan.quests.filter(q => q.blocked);
      h += `<div class="sys-msg"><b>${esc(plan.title || 'Daily Quest')}</b> — ${st.done}/${st.total} cleared${plan.bonusClaimed ? ' ✓' : ''}<br><span class="muted">${esc(plan.message || '')}</span>
        ${blocked.length ? `<br><span class="muted">⤺ blocked: ${blocked.map(q => esc(questTitle(q)) + (q.reason ? ` (${esc(q.reason)})` : '')).join(', ')}</span>` : ''}</div>`;
    }
    if (note(d)) h += `<div class="bonus-box" style="border-color:var(--line-soft);color:var(--text)"><b>Your note</b><br>${esc(note(d)).replace(/\n/g, '<br>')}</div>`;
    const focusMin = Object.values(db.log).filter(e => !e.deleted && e.type === 'focus' && e.day === d).reduce((a, e) => a + (+e.minutes || 0), 0);
    if (focusMin) h += `<p class="muted" style="font-size:14px;margin:10px 0 0">⏱ Focused time recorded: <b>${focusMin} min</b></p>`;
    if (!entries.length) h += `<div class="empty">Nothing recorded on this day.</div>`;
    if (entries.length > 60) h += `<p class="muted" style="font-size:13px">Showing the last 60 of ${entries.length} entries.</p>`;
    for (const e of entries.slice(-60)) {
      const icon = { done: '✓', sub: '·', bonus: '★', buy: '🎁', item: '⚔', use: '⚗', awaken: '✦', focus: '⏱' }[e.type] || '•';
      const right = e.type === 'buy' || e.type === 'item' ? `<span style="color:var(--gold)">-${e.cost} G</span>`
        : e.type === 'focus' ? `<span class="muted">${e.minutes} min</span>` : (e.xp ? `<span style="color:var(--accent)">+${e.xp} XP</span>` : '');
      h += `<div class="log-row"><span class="li">${icon}</span><span class="grow">${esc(e.title || ITEMS[e.key]?.name || e.type)}</span>${right}</div>`;
    }
    h += `</div></div>`;
  } else h += `<p class="muted" style="text-align:center">Tap a day to see what you did.</p>`;
  return h;
}
function viewShop(p) {
  const items = Object.values(db.shop).filter(i => !i.deleted).sort((a, b) => a.cost - b.cost);
  const buys = Object.values(db.log).filter(e => e.type === 'buy' && !e.deleted).sort((a, b) => b.at - a.at).slice(0, 15);
  let h = `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">◆</span>SHOP <span style="margin-left:auto;color:var(--gold)">${p.gold} G</span></div><div class="sys-body">
    <p class="muted" style="margin-top:0">Define your own rewards and buy them with gold earned from quests.</p>
    <div class="row"><input id="shopName" placeholder="Reward (e.g. 1h gaming)" class="grow"><input id="shopCost" type="number" placeholder="G" style="width:90px" min="1"><button class="btn primary" data-act="shopAdd">+</button></div>`;
  h += items.length ? items.map(i => `<div class="shop-item"><div class="grow">${esc(i.title)}</div><span class="price">${i.cost} G</span><button class="btn small ${p.gold >= i.cost ? 'primary' : ''}" data-act="buy" data-id="${i.id}" ${p.gold >= i.cost ? '' : 'disabled'}>Buy</button><button class="icon-btn" data-act="shopDel" data-id="${i.id}">✕</button></div>`).join('') : `<div class="empty">No rewards yet.</div>`;
  h += `</div></div>`;
  // system items
  h += `<div class="sys-window card"><div class="sys-head"><span class="sys-icon">⚔</span>SYSTEM ITEMS</div><div class="sys-body">
    <p class="muted" style="margin-top:0;font-size:14px">Bought with gold, used when the day goes wrong.</p>
    ${Object.entries(ITEMS).map(([k, it]) => `<div class="shop-item"><span class="item-ico">${it.icon}</span><div class="grow"><b>${it.name}</b> ${p.inv[k] ? `<span class="owned">×${p.inv[k]}</span>` : ''}<div class="muted" style="font-size:13px">${esc(it.desc)}</div></div>
      <span class="price">${it.cost} G</span><button class="btn small ${p.gold >= it.cost ? 'primary' : ''}" data-act="buyItem" data-id="${k}" ${p.gold >= it.cost ? '' : 'disabled'}>Buy</button>
      ${k === 'potion' && p.inv.potion && !p.potionActive ? `<button class="btn small" data-act="useItem" data-id="potion">Use</button>` : ''}</div>`).join('')}
    ${p.potionActive ? `<div class="bonus-box">⚗ EXP Potion active — double EXP until the day resets.</div>` : ''}
    ${p.inv.shield ? `<p class="muted" style="font-size:13px">⛨ ${p.inv.shield} shield(s) ready — used automatically when a daily quest fails.</p>` : ''}
    ${p.inv.skip ? `<p class="muted" style="font-size:13px">⏭ ${p.inv.skip} skip token(s) — the skip button sits next to each quest.</p>` : ''}
  </div></div>`;
  if (buys.length) h += `<div class="section-title">PURCHASE LOG</div>` + buys.map(b => `<div class="shop-item"><div class="grow">${esc(b.title)}<div class="muted" style="font-size:13px">${esc(fmtDay(b.day))}</div></div><span class="price">-${b.cost} G</span></div>`).join('');
  return h;
}
function viewSettings() {
  const s = S(); const cid = Drive.clientId();
  return `<div class="sys-window card"><div class="sys-head">PLAYER</div><div class="sys-body">
    <label>Hunter name</label><input id="setName" value="${esc(s.name)}">
    <div class="grid2"><div><label>Daily time budget (min)</label><input id="setMin" type="number" min="15" value="${s.dailyMinutes}"></div>
    <div><label>Max quests / day</label><input id="setMax" type="number" min="1" max="15" value="${s.maxQuests}"></div></div>
    <div class="grid2"><div><label>Timezone (UTC+)</label><input id="setTz" type="number" step="0.5" value="${s.tz}"></div>
    <div><label>Day resets at (hour)</label><input id="setReset" type="number" min="0" max="12" value="${s.resetHour}"></div></div>
    <label>Standing orders (every plan respects these)</label>
    <textarea id="setStanding" rows="3" placeholder="e.g. I train in the mornings · no coding on Sundays · never more than 2 job applications a day">${esc(s.standing || '')}</textarea>
    <label class="row" style="text-transform:none;letter-spacing:0;font-size:15px;margin-top:14px"><input type="checkbox" id="setSound" ${s.sound ? 'checked' : ''}> System sounds</label>
    <button class="btn primary" style="margin-top:12px" data-act="saveSettings">Save</button></div></div>

  <div class="sys-window card"><div class="sys-head">GOOGLE DRIVE SYNC</div><div class="sys-body">
    <p class="muted" style="margin-top:0">Data file: <code>My Drive/${FOLDER}/${DBFILE}</code>. AI plans: <code>ai-plan-YYYY-MM-DD.json</code>.</p>
    <label>OAuth Client ID</label><input id="setCid" value="${esc(cid)}" placeholder="xxxx.apps.googleusercontent.com">
    <div class="row wrap" style="margin-top:10px">
      ${Drive.configured() ? `<button class="btn primary" data-act="driveConnect">${Drive.ready() ? '⟳ Sync now' : 'Reconnect'}</button><button class="btn danger" data-act="driveOff">Disable sync</button>` : `<button class="btn primary" data-act="driveOn">Connect Google Drive</button>`}
    </div>
    <p class="muted" style="font-size:14px">${lastSync ? 'Last sync: ' + new Date(lastSync).toLocaleString() : 'Never synced.'} ${syncErr ? '<br><span style="color:var(--red)">' + esc(syncErr) + '</span>' : ''}</p></div></div>

  <div class="sys-window card"><div class="sys-head">AI — CLAUDE HAIKU</div><div class="sys-body">
    <p class="muted" style="margin-top:0">Key is encrypted with your password before it touches Drive. ${db.security?.apiKey ? '<b style="color:var(--green)">Key stored ✓</b>' : '<b>No key.</b>'}</p>
    <label>Anthropic API key</label><div class="row"><input id="setKey" type="password" placeholder="${db.security?.apiKey ? '•••••••• (enter to replace)' : 'sk-ant-...'}" class="grow"><button class="btn" data-act="saveKey">Save</button>${db.security?.apiKey ? '<button class="btn danger" data-act="delKey">✕</button>' : ''}</div>
    <div class="grid2"><div><label>Model</label><input id="setModel" value="${esc(s.model)}"></div>
    <div><label>Haiku fallback after (hour)</label><input id="setFb" type="number" min="${s.resetHour}" max="23" value="${s.fallbackHour}"></div></div>
    <label class="row" style="text-transform:none;letter-spacing:0;font-size:15px;margin-top:14px"><input type="checkbox" id="setAuto" ${s.autoHaiku ? 'checked' : ''}> Auto-plan with Haiku if Claude hasn't planned by the fallback hour</label>
    <button class="btn primary" style="margin-top:12px" data-act="saveSettings">Save</button></div></div>

  <div class="sys-window card"><div class="sys-head">SECURITY &amp; DATA</div><div class="sys-body">
    <label>Change password</label><input id="pwOld" type="password" placeholder="Current password"><div style="height:8px"></div>
    <input id="pwNew" type="password" placeholder="New password (min 6)"><div class="row" style="margin-top:8px"><button class="btn" data-act="chPw">Change</button></div>
    <hr><div class="row wrap"><button class="btn" data-act="export">Export JSON</button><button class="btn" data-act="import">Import JSON</button><button class="btn danger" data-act="lock">Lock now</button></div>
    <input type="file" id="importFile" accept="application/json" class="hidden"></div></div>
  <p class="muted" style="text-align:center;font-size:13px">THE SYSTEM v1 · day ${esc(today())}</p>`;
}

// ---------- EDIT MODAL
let editing = null;
function openEdit(id) {
  const t = db.tasks[id]; if (!t) return;
  editing = JSON.parse(JSON.stringify(t));
  renderEdit(); $('#modal').classList.remove('hidden');
  history.pushState({ tab, modal: 1 }, ''); // so Android back closes the dialog first
}
function renderEdit() {
  const t = editing, r = t.repeat;
  $('#modalBox').innerHTML = `<div class="sys-head"><span class="sys-icon">✎</span>EDIT QUEST<button class="icon-btn" style="margin-left:auto" data-m="close">✕</button></div><div class="sys-body">
    <label>Title</label><input id="eTitle" value="${esc(t.title)}">
    <label>Notes (for you)</label><textarea id="eNotes">${esc(t.notes)}</textarea>
    <label>💬 Message to the System (read when it splits &amp; schedules this)</label>
    <textarea id="eHint" rows="2" placeholder="e.g. split by chapters · only evenings · needs the lab PC · do the boring part first">${esc(t.hint || '')}</textarea>
    <div class="grid2"><div><label>Deadline</label><input id="eDeadline" type="date" value="${esc(t.deadline)}"></div>
    <div><label>Rank (difficulty)</label><select id="eRank">${RANKS.map(x => `<option ${x === t.rank ? 'selected' : ''} value="${x}">${x} · ${RANK_XP[x]} XP</option>`).join('')}</select></div></div>
    <label>Stat</label><select id="eStat">${Object.entries(STATS).map(([k, v]) => `<option value="${k}" ${k === t.stat ? 'selected' : ''}>${k} — ${v} (${STAT_HINT[k]})</option>`).join('')}</select>
    <label class="row" style="text-transform:none;letter-spacing:0;font-size:15px"><input type="checkbox" id="eDungeon" ${t.dungeon ? 'checked' : ''}> ⚔ Dungeon — track it as a project and get a medal when it's cleared</label>

    <label>Subtasks</label>
    <div id="eSubs">${t.subtasks.map((s, i) => `<div class="sub-row"><input type="checkbox" class="chk" data-m="subchk" data-i="${i}" ${s.done ? 'checked' : ''}><input type="text" data-m="subtxt" data-i="${i}" value="${esc(s.title)}" class="grow"><button class="icon-btn" data-m="subdel" data-i="${i}">✕</button></div>`).join('')}</div>
    <div class="row"><input id="eNewSub" placeholder="Add subtask…" class="grow"><button class="btn small" data-m="subadd">+</button>${db.security?.apiKey ? `<button class="btn small" data-m="aisplit">⚡ Split with AI</button>` : ''}</div>

    <label>Reward</label><div class="row"><input id="eReward" placeholder="e.g. watch 1 episode" value="${esc(t.reward?.text || '')}" class="grow"><input id="eGold" type="number" min="0" placeholder="+G" style="width:80px" value="${+t.reward?.gold || ''}"></div>

    <label>Repeat</label>
    <select id="eRepeat">${[['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'On weekdays…'], ['interval', 'Every N days'], ['after', 'N days after completion'], ['monthly', 'Every month']].map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    ${r.type === 'weekly' ? `<div class="days" style="margin-top:8px">${DAYS.map((d, i) => `<button data-m="day" data-i="${i}" class="${(r.days || []).includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>` : ''}
    ${r.type === 'interval' || r.type === 'after' ? `<div class="row" style="margin-top:8px"><span class="muted">N =</span><input id="eEvery" type="number" min="1" value="${r.every || 1}" style="width:90px"><span class="muted">days</span></div>` : ''}
    <div class="err" id="eErr"></div>
    <div class="row" style="margin-top:14px"><button class="btn danger" data-m="del">Delete</button><span class="grow"></span><button class="btn" data-m="close">Cancel</button><button class="btn primary" data-m="save">Save</button></div></div>`;
}
function readEditFields() {
  const t = editing; if (!$('#eTitle')) return;
  t.title = $('#eTitle').value.trim() || t.title; t.notes = $('#eNotes').value; t.deadline = $('#eDeadline').value;
  t.rank = $('#eRank').value; t.stat = $('#eStat').value; t.reward = { text: $('#eReward').value.trim(), gold: +$('#eGold').value || 0 };
  if ($('#eDungeon')) t.dungeon = $('#eDungeon').checked;
  if ($('#eHint')) t.hint = $('#eHint').value.trim().slice(0, 500);
  t.repeat.type = $('#eRepeat').value; if ($('#eEvery')) t.repeat.every = Math.max(1, +$('#eEvery').value || 1);
  $$('[data-m=subtxt]').forEach(el => { const s = t.subtasks[+el.dataset.i]; if (s) s.title = el.value; });
}
let asking = null;
function askText({ title, label, placeholder = '', value = '', ok = 'OK' }, cb) {
  asking = cb; editing = null;
  $('#modalBox').innerHTML = `<div class="sys-head"><span class="sys-icon">?</span>${esc(title)}<button class="icon-btn" style="margin-left:auto" data-ask="cancel">✕</button></div>
    <div class="sys-body"><label>${esc(label)}</label><textarea id="askInput" rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" data-ask="cancel">Cancel</button><button class="btn primary" data-ask="ok">${esc(ok)}</button></div></div>`;
  $('#modal').classList.remove('hidden'); history.pushState({ tab, modal: 1 }, '');
  setTimeout(() => $('#askInput')?.focus(), 60);
}
$('#modal').addEventListener('click', async e => {
  const ab = e.target.closest('[data-ask]');
  if (ab) { const v = $('#askInput')?.value || ''; const cb = asking; asking = null; closeModal(); if (ab.dataset.ask === 'ok' && cb) cb(v.trim()); return; }
  if (e.target.id === 'modal') return closeModal();
  if (!editing) return;
  const b = e.target.closest('[data-m]'); if (!b) return;
  const m = b.dataset.m, i = +b.dataset.i;
  if (m === 'subtxt') return;
  readEditFields();
  const t = editing;
  if (m === 'close') return closeModal();
  if (m === 'subadd') { const v = $('#eNewSub').value.trim(); if (v) t.subtasks.push({ id: uid(), title: v, done: false }); renderEdit(); $('#eNewSub').focus(); return; }
  if (m === 'subdel') { t.subtasks.splice(i, 1); return renderEdit(); }
  if (m === 'subchk') { t.subtasks[i].done = b.checked; return; }
  if (m === 'day') { const ds = new Set(t.repeat.days || []); ds.has(i) ? ds.delete(i) : ds.add(i); t.repeat.days = [...ds].sort(); return renderEdit(); }
  if (m === 'aisplit') {
    b.innerHTML = '<span class="spin">◌</span>'; b.disabled = true;
    try { const res = await splitWithAI(t); for (const s of res.subtasks || []) if (!t.subtasks.some(x => norm(x.title) === norm(s))) t.subtasks.push({ id: uid(), title: String(s), done: false }); if (RANKS.includes(res.rank)) t.rank = res.rank; renderEdit(); }
    catch (err) { $('#eErr').textContent = 'AI: ' + err.message; b.textContent = '⚡ Split with AI'; b.disabled = false; }
    return;
  }
  if (m === 'del') { if (!confirmInline(b, 'Sure?')) return; const o = db.tasks[t.id]; o.deleted = true; touch(o); closeModal(); save(); return; }
  if (m === 'save') {
    const orig = db.tasks[t.id];
    // log subtask completions toggled inside modal
    const before = player();
    for (const s of t.subtasks) { const os = orig.subtasks.find(x => x.id === s.id); if (s.done && (!os || !os.done)) logAdd({ type: 'sub', taskId: t.id, subId: s.id, title: s.title, xp: questFor(t.id, s.id)?.xp || 5, gold: 2, stat: t.stat }); }
    if (t.repeat.type === 'weekly' && !(t.repeat.days || []).length) t.repeat.days = [weekday(today())];
    if (t.repeat.type === 'none') t.nextDay = '';
    t.subtasks = t.subtasks.filter(s => s.title.trim());
    db.tasks[t.id] = touch(t); closeModal(); afterProgress(before); save();
  }
});
$('#modal').addEventListener('change', e => { if (e.target.id === 'eRepeat') { readEditFields(); renderEdit(); } });
$('#modal').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'eNewSub') { e.preventDefault(); $('[data-m=subadd]').click(); } });
function closeModal(fromBack) {
  $('#modal').classList.add('hidden'); editing = null; asking = null;
  if (!fromBack && history.state?.modal) history.back();
}
function confirmInline(b, txt) { if (b.dataset.confirm) return true; b.dataset.confirm = 1; b.textContent = txt; setTimeout(() => { delete b.dataset.confirm; }, 3000); return false; }

// ---------- EVENTS
let noteT = null;
function bind(v) {
  const nt = $('#newTask', v);
  if (nt) nt.onkeydown = e => { if (e.key === 'Enter') addTask(); };
  const qq = $('#quickQuest', v);
  if (qq) qq.onkeydown = e => { if (e.key === 'Enter') { const t = qq.value.trim(); if (t) { qq.value = ''; addUrgentQuest(t); } } };
  const nb = $('#noteBox', v);
  if (nb) nb.oninput = () => {
    clearTimeout(noteT);
    $('#noteSaved').textContent = '…';
    noteT = setTimeout(() => { setNote(nb.value); const s = $('#noteSaved'); if (s) s.textContent = '✓ saved'; }, 600);
  };
}
function addTask() {
  const el = $('#newTask'); const v = el.value.trim(); if (!v) return;
  el.value = ''; newTask(v); sfx('tick'); save(); $('#newTask')?.focus();
}
document.addEventListener('click', async e => {
  const nav = e.target.closest('.bottomnav button');
  if (nav) { go(nav.dataset.tab); return; }
  if (e.target.closest('#syncBtn')) { if (Drive.configured() && !Drive.ready()) { try { await Drive.connect(''); } catch (err) { syncErr = err.message; } } sync(); return; }
  const b = e.target.closest('#view [data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id, t = id ? db.tasks[id] : null;
  switch (a) {
    case 'add': return addTask();
    case 'toggle': e.preventDefault(); return t.done ? uncompleteTask(t) : completeTask(t);
    case 'edit': return openEdit(id);
    case 'hint': return askText({
      title: 'Message to the System', label: `About "${t.title}" — read when it is split and scheduled`,
      placeholder: 'e.g. split by chapters · evenings only · needs the lab PC · don\'t give me this before Friday',
      value: t.hint || '', ok: 'Save'
    }, v => { t.hint = v.slice(0, 500); touch(t); toast(v ? '💬 saved' : 'message cleared'); save(); });
    case 'pin': t.pinDay = t.pinDay === today() ? '' : today(); touch(t); return save();
    case 'tgDone': ui.showDone = !ui.showDone; return render();
    case 'tgSched': ui.showSched = !ui.showSched; return render();
    case 'quest': {
      e.preventDefault();
      const q = db.plans[today()].quests[+b.dataset.i]; const qt = db.tasks[q.taskId];
      if (q.subId) { const s = qt.subtasks.find(x => x.id === q.subId); if (s) toggleSub(qt, s); }
      else if (questDone(q, today())) uncompleteTask(qt); else completeTask(qt);
      return;
    }
    case 'addQuest': {
      const el = $('#quickQuest'); const v = el.value.trim(); if (!v) return;
      el.value = ''; return addUrgentQuest(v);
    }
    case 'block': {
      const i = +b.dataset.i;
      return askText({ title: 'Blocked quest', label: 'Why can\'t it be done today? (optional — Claude reads this)', placeholder: 'waiting for the client / library is broken / no access', ok: 'Send back to Tasks' },
        reason => blockQuest(i, reason));
    }
    case 'unblock': return unblockQuest(+b.dataset.i);
    case 'reroll': if (!confirmInline(b, '⟳?')) return; return rerollQuest(+b.dataset.i);
    case 'timerStart': { const q = db.plans[today()].quests[+b.dataset.i]; return Timer.start(q.taskId, q.subId); }
    case 'timerStop': e.preventDefault(); return Timer.stop(false);
    case 'genHaiku': case 'regen': if (a === 'regen' && !confirmInline(b, 'Tap again to confirm')) return; return generatePlanHaiku(a === 'regen');
    case 'genLocal': case 'genLocalForce': if (a === 'genLocalForce') delete db.plans[today()]; applyPlan(localPlan(), 'local'); sfx('level'); return save();
    case 'sync': if (!Drive.ready()) { try { await Drive.connect(''); } catch (err) { return toast(err.message); } } return sync();
    case 'equip': S().title = S().title === id ? '' : id; touch(S()); return save();
    case 'awaken': if (!confirmInline(b, 'Tap again to Awaken')) return; return awaken();
    case 'tgShadows': ui.allShadows = !ui.allShadows; return render();
    case 'cal': ui.calMonth = id; return render();
    case 'calday': ui.calDay = ui.calDay === id ? '' : id; return render();
    case 'buyItem': {
      const it = ITEMS[id]; if (player().gold < it.cost) return;
      if (!confirmInline(b, `${it.cost} G?`)) return;
      logAdd({ type: 'item', key: id, cost: it.cost, title: it.name }); sfx('done'); toast(`${it.icon} ${it.name} acquired`); return save();
    }
    case 'useItem': {
      const it = ITEMS[id]; if (player().inv[id] < 1) return;
      logAdd({ type: 'use', key: id, title: it.name }); sfx('level');
      popup({ title: 'Item Used', text: `${it.icon} ${esc(it.name)}`, reward: esc(it.desc) }); return save();
    }
    case 'skipQuest': {
      const p2 = player(); if (p2.inv.skip < 1) return toast('No skip tokens');
      if (!confirmInline(b, '⏭?')) return;
      const plan = db.plans[today()]; const q = plan.quests[+b.dataset.i];
      q.skipped = true; touch(plan);
      logAdd({ type: 'use', key: 'skip', title: 'Skip Token' });
      toast('Quest skipped — no penalty'); checkDailyClear(); return save();
    }
    case 'shopAdd': { const n = $('#shopName').value.trim(), c = +$('#shopCost').value; if (!n || !(c > 0)) return toast('Name and price needed'); const it = touch({ id: uid(), title: n, cost: Math.round(c) }); db.shop[it.id] = it; return save(); }
    case 'shopDel': { const it = db.shop[id]; it.deleted = true; touch(it); return save(); }
    case 'buy': { const it = db.shop[id]; if (player().gold < it.cost) return; if (!confirmInline(b, 'Confirm?')) return; logAdd({ type: 'buy', title: it.title, cost: it.cost, itemId: it.id }); sfx('done'); popup({ title: 'Item Purchased', text: esc(it.title), reward: `-${it.cost} G · Enjoy it. You earned it.` }); return save(); }
    case 'saveSettings': {
      const s = S();
      if ($('#setName')) { s.name = $('#setName').value.trim() || 'Hunter'; s.dailyMinutes = Math.max(15, +$('#setMin').value || 180); s.maxQuests = clamp(+$('#setMax').value || 6, 1, 15); s.tz = +$('#setTz').value; s.resetHour = clamp(+$('#setReset').value, 0, 12); s.sound = $('#setSound').checked; s.standing = $('#setStanding').value.trim().slice(0, 1000); }
      if ($('#setModel')) { s.model = $('#setModel').value.trim() || 'claude-haiku-4-5'; s.fallbackHour = clamp(+$('#setFb').value, 0, 27); s.autoHaiku = $('#setAuto').checked; }
      touch(s); toast('Saved'); return save();
    }
    case 'saveKey': { const k = $('#setKey').value.trim(); if (!k) return; db.security.apiKey = await encStr(cryptoKey, k); touch(db.security); apiKeyCache = k; toast('API key encrypted & saved'); return save(); }
    case 'delKey': db.security.apiKey = null; apiKeyCache = null; touch(db.security); return save();
    case 'driveOn': case 'driveConnect': {
      const v = $('#setCid').value.trim(); if (!v) return toast('Enter the Client ID first');
      if (v !== Drive.clientId()) { LS.set('ss_client_id', v); Drive.client = null; }
      LS.set('ss_drive_on', true);
      if (!Drive.ready()) { try { await Drive.connect(a === 'driveOn' ? 'consent' : ''); } catch (err) { syncErr = err.message; render(); return toast('Google: ' + err.message); } }
      return sync();
    }
    case 'driveOff': LS.set('ss_drive_on', false); Drive.token = null; LS.del('ss_tok'); return render();
    case 'chPw': {
      const o = $('#pwOld').value, n = $('#pwNew').value; if (n.length < 6) return toast('New password too short');
      try {
        const k = await deriveKey(o, db.security.salt); if (await decStr(k, db.security.verifier) !== VERIFIER) throw 0;
        const key = await getApiKey(); const salt = b64(crypto.getRandomValues(new Uint8Array(16))); const nk = await deriveKey(n, salt);
        db.security = { salt, verifier: await encStr(nk, VERIFIER), apiKey: key ? await encStr(nk, key) : null, updatedAt: now() };
        cryptoKey = nk; if (LS.get('ss_remember', false)) await IDB.set('key', nk); toast('Password changed. Other devices will ask for the new one.'); return save();
      } catch { return toast('Current password is wrong'); }
    }
    case 'export': { const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `system-backup-${today()}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); return; }
    case 'import': $('#importFile').onchange = async ev => { try { const j = JSON.parse(await ev.target.files[0].text()); const sec = db.security; db = mergeDB(db, j); db.security = sec; toast('Imported & merged'); save(); } catch (err) { toast('Import failed: ' + err.message); } }; $('#importFile').click(); return;
    case 'lock': return lockNow();
  }
});
setInterval(() => {
  const t = $('#timer'); if (t) t.textContent = '⏱ ' + countdown();
  const f = $('#focusT'); if (f) f.textContent = fmtSecs(Timer.elapsed());
}, 1000);
// day rollover + periodic sync
let lastDay = null;
setInterval(() => { if (!cryptoKey) return; const d = today(); if (lastDay && d !== lastDay) { runDaily(); render(); maybeAutoPlan(); } lastDay = d; }, 30e3);
setInterval(() => { if (cryptoKey && Drive.configured()) sync(); }, 3 * 60e3);
document.addEventListener('visibilitychange', () => {
  if (!cryptoKey) return;
  if (document.visibilityState === 'visible') { runDaily(); render(); Drive.scheduleRefresh(); sync(); }
  else flushSync();
});
window.addEventListener('pagehide', flushSync);
window.addEventListener('beforeunload', flushSync);
window.addEventListener('online', () => { if (cryptoKey) sync(); });
// any tap counts as a user gesture, so a dead token can be renewed without the user noticing
document.addEventListener('pointerdown', () => {
  if (cryptoKey && Drive.configured() && !Drive.ready() && !Drive.pending) Drive.silent().then(() => sync()).catch(() => { });
}, true);

// ---------- Android back button: go one step back instead of closing the app
function go(t) { if (t === tab) return; tab = t; LS.set('ss_tab', t); history.pushState({ tab: t }, ''); render(); window.scrollTo(0, 0); }
window.addEventListener('popstate', e => {
  if (!$('#modal').classList.contains('hidden')) { closeModal(true); return; }
  const st = e.state || {};
  if (st.tab && st.tab !== tab) { tab = st.tab; LS.set('ss_tab', tab); render(); window.scrollTo(0, 0); }
  else if (!st.tab && tab !== 'quests') { tab = 'quests'; LS.set('ss_tab', tab); render(); }
});

// ---------- boot
(async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  const sec = LS.get('ss_security', null); if (sec) db.security = sec;
  if (await tryRememberedKey()) { enterApp(); if (Drive.ready()) sync(); return; }
  renderLock();
})();
window.__SS = { get db() { return db; }, applyPlan, localPlan, plannerInput, player, today, mergeDB };
