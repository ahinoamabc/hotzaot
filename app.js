'use strict';

/* ================= קבועים ================= */

const CATEGORIES = [
  { id: 'super',     name: 'סופר',            short: 'סופר',         icon: '🛒' },
  { id: 'clothes',   name: 'בגדים',           short: 'בגדים',        icon: '👗' },
  { id: 'bills',     name: 'חשבונות',         short: 'חשבונות',      icon: '💡' },
  { id: 'rent',      name: 'שכירות',          short: 'שכירות',       icon: '🏠' },
  { id: 'eatout',    name: 'אוכל בחוץ',       short: 'אוכל בחוץ',    icon: '🍽️' },
  { id: 'subs',      name: 'מנויים',          short: 'מנויים',       icon: '📱' },
  { id: 'transit',   name: 'תחבורה ציבורית',  short: 'תחבורה',       icon: '🚌' },
  { id: 'fuel',      name: 'דלק',             short: 'דלק',          icon: '⛽' },
  { id: 'bituach',   name: 'ביטוח לאומי',     short: 'ביטוח לאומי',  icon: '🏛️' },
  { id: 'gifts',     name: 'מתנות',           short: 'מתנות',        icon: '🎁' },
  { id: 'culture',   name: 'תרבות',           short: 'תרבות',        icon: '🎭' },
  { id: 'care',      name: 'טיפוח',           short: 'טיפוח',        icon: '💅' },
  { id: 'fitness',   name: 'כושר',            short: 'כושר',         icon: '🏋️' },
  { id: 'misc',      name: 'שונות',           short: 'שונות',        icon: '📦' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const PAYMENTS = [
  { id: 'max',     name: 'מקס' },
  { id: 'onezero', name: 'וואן זירו' },
  { id: 'lochem',  name: 'לוחם' },
  { id: 'bit',     name: 'ביט' },
];
// check ו-fixed לא מופיעים ככפתורים: הם רק להוצאות קבועות (למשל השכירות בצ'קים)
const PAY_NAME = { ...Object.fromEntries(PAYMENTS.map(p => [p.id, p.name])), fixed: 'קבוע', check: "צ'ק" };

const INCOME_SOURCES = [
  { id: 'unemployment', name: 'אבטלה',  icon: '🏛️' },
  { id: 'elections',    name: 'בחירות', icon: '🗳️' },
  { id: 'salary',       name: 'משכורת', icon: '💼' },
  { id: 'other',        name: 'אחר',    icon: '➕' },
];
const SRC = Object.fromEntries(INCOME_SOURCES.map(s => [s.id, s]));
const TABLES = ['expenses', 'incomes', 'settlements'];   // טבלאות שמסתנכרנות שורה-שורה

const FIRST_MONTH = '2026-11';   // החודש הראשון באפליקציה
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// הקוד ציבורי ב-GitHub, אז אין כאן מספרים אישיים.
// היתרה, ההוצאות הקבועות והתקציבים נשמרים בטבלת settings ב-Supabase.
const DEFAULT_SETTINGS = {
  bank: { balance: 0, pending: 0, asOf: null },
  fixed: [],     // [{ key, name, amount, category, payment? }]
  budgets: {},   // { categoryId: amount }
};

const SUPABASE_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const STORE_KEY = 'hotzaot.v1';
const PREFS_KEY = 'hotzaot.prefs';

/* ================= עזרים ================= */

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const monthOf = date => date.slice(0, 7);
function shiftMonth(ym, delta) {
  let [y, m] = ym.split('-').map(Number);
  m += delta; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return `${y}-${pad(m)}`;
}
const monthTitle = ym => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
const round2 = n => Math.round(n * 100) / 100;
function money(n) {
  const v = round2(n || 0);
  return v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₪';
}
function parseNum(s) { const n = parseFloat(String(s).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null; }
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function readJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* אין אחסון — ממשיכים בזיכרון */ } }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateLabel(d) {
  if (d === daysAgo(0)) return 'היום';
  if (d === daysAgo(1)) return 'אתמול';
  if (d === daysAgo(2)) return 'שלשום';
  return `${Number(d.slice(8))}.${Number(d.slice(5, 7))}`;
}

/* ================= נתונים ================= */

let db = readJSON(STORE_KEY, null) || {
  expenses: {}, settlements: {},
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), settingsUpdated: null,
  queue: [],   // [{ table, id, v }] שינויים שעוד לא עלו לענן
};
db.settings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...db.settings };
db.incomes = db.incomes || {};
const prefs = readJSON(PREFS_KEY, { lastPayment: 'max', skipLogin: false });

const persist = () => writeJSON(STORE_KEY, db);
const savePrefs = () => writeJSON(PREFS_KEY, prefs);

function enqueue(table, id, v) {
  db.queue = db.queue.filter(q => !(q.table === table && q.id === id));
  db.queue.push({ table, id, v });
}
function putExpense(row) {
  row.updated_at = new Date().toISOString();
  db.expenses[row.id] = row;
  enqueue('expenses', row.id, row.updated_at);
}
function putIncome(row) {
  row.updated_at = new Date().toISOString();
  db.incomes[row.id] = row;
  enqueue('incomes', row.id, row.updated_at);
}
function putSettlement(row) {
  row.updated_at = new Date().toISOString();
  db.settlements[row.id] = row;
  enqueue('settlements', row.id, row.updated_at);
}
function putSettings() {
  db.settingsUpdated = new Date().toISOString();
  enqueue('settings', 'settings', db.settingsUpdated);
}

const liveExpenses = () => Object.values(db.expenses).filter(e => !e.deleted);
const monthExpenses = ym => liveExpenses().filter(e => monthOf(e.date) === ym);
const monthIncomes = ym => Object.values(db.incomes).filter(i => !i.deleted && monthOf(i.date) === ym);
function partnerBalance() {
  const owed = liveExpenses().filter(e => e.shared).reduce((s, e) => s + (e.amount - e.my_share), 0);
  const paid = Object.values(db.settlements).filter(s => !s.deleted).reduce((s, x) => s + x.amount, 0);
  return round2(owed - paid);
}

// ההוצאות הקבועות נכתבות כשורות רגילות בחודש הנוכחי, פעם אחת
let canMaterialize = false;
function ensureFixed() {
  if (!canMaterialize) return false;
  const ym = monthOf(todayStr());
  if (ym < FIRST_MONTH) return false;
  let added = false;
  for (const f of db.settings.fixed || []) {
    const id = `fixed-${ym}-${f.key}`;
    if (db.expenses[id]) continue;
    putExpense({ id, date: `${ym}-01`, amount: f.amount, my_share: f.amount, category: f.category,
      payment: f.payment || 'fixed', shared: false, note: f.name, source: 'fixed', deleted: false });
    added = true;
  }
  if (added) persist();
  return added;
}

/* ================= ענן (Supabase) ================= */

let sb = null, session = null, syncing = false, syncAgain = false;
let cloud = 'local';           // local | connecting | ready | offline
let syncState = { status: 'idle', at: null, error: null };

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initCloud() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    cloud = 'local'; canMaterialize = true; ensureFixed(); render(); return;
  }
  cloud = 'connecting';
  try { await loadScript(SUPABASE_SRC); }
  catch (e) { cloud = 'offline'; render(); return; }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  cloud = 'ready';
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_ev, s) => { session = s; render(); });
  if (session) sync();
  else if (!prefs.skipLogin) showView('login');
  render();
}

async function fetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function sync() {
  if (!sb || !session) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncState.status = 'syncing'; renderSync();
  try {
    const user_id = session.user.id;
    const batch = [...db.queue];

    // 1. מעלים שינויים מקומיים
    for (const table of TABLES) {
      const rows = batch.filter(q => q.table === table).map(q => db[table][q.id]).filter(Boolean)
        .map(r => ({ ...r, user_id }));
      if (rows.length) {
        const { error } = await sb.from(table).upsert(rows, { onConflict: 'user_id,id' });
        if (error) throw error;
      }
    }
    if (batch.some(q => q.table === 'settings')) {
      const { error } = await sb.from('settings').upsert({ user_id, data: db.settings, updated_at: db.settingsUpdated });
      if (error) throw error;
    }
    db.queue = db.queue.filter(q => !batch.some(b => b.table === q.table && b.id === q.id && b.v === q.v));

    // 2. מורידים הכל מהענן (שומרים על מה שעוד ממתין להעלאה)
    for (const table of TABLES) {
      const remote = await fetchAll(table);
      const next = {};
      for (const r of remote) {
        const { user_id: _u, ...row } = r;
        row.amount = Number(row.amount);
        if (row.my_share != null) row.my_share = Number(row.my_share);
        next[row.id] = row;
      }
      for (const q of db.queue) if (q.table === table && db[table][q.id]) next[q.id] = db[table][q.id];
      db[table] = next;
    }
    const { data: srow, error: serr } = await sb.from('settings').select('*').maybeSingle();
    if (serr) throw serr;
    if (!db.queue.some(q => q.table === 'settings')) {
      if (srow) { db.settings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...srow.data }; db.settingsUpdated = srow.updated_at; }
      else putSettings();
    }

    canMaterialize = true;
    if (ensureFixed() || db.queue.length) syncAgain = true;
    persist();
    syncState = { status: 'ok', at: new Date(), error: null };
  } catch (e) {
    console.error(e);
    syncState = { status: 'error', at: syncState.at, error: e.message || String(e) };
  } finally {
    syncing = false;
    render();
    if (syncAgain && syncState.status === 'ok') { syncAgain = false; sync(); }
    syncAgain = false;
  }
}

/* ================= מסך רישום ================= */

// kind: 'expense' | 'income'
const form = { kind: 'expense', editId: null, amount: '', category: null, source: null, payment: prefs.lastPayment || 'max', shared: false, split: 3, customShare: null, date: todayStr(), note: '' };

function resetForm() {
  Object.assign(form, { kind: 'expense', editId: null, amount: '', category: null, source: null, payment: prefs.lastPayment || 'max', shared: false, split: 3, customShare: null, date: todayStr(), note: '' });
  $('note-input').value = '';
  $('note-input').classList.add('hidden');
  $('date-row').classList.add('hidden');
}
const amountValue = () => parseNum(form.amount) || 0;
function myShare() {
  const a = amountValue();
  if (!form.shared) return a;
  if (form.split === 'custom') return Math.min(form.customShare ?? a, a);
  return round2(a / form.split);
}

function buildAddView() {
  $('cat-grid').innerHTML = CATEGORIES.map(c =>
    `<button type="button" class="cat-btn" data-cat="${c.id}"><span class="ic">${c.icon}</span><span>${esc(c.short)}</span></button>`).join('');
  $('pay-row').innerHTML = PAYMENTS.map(p =>
    `<button type="button" class="pay-btn" data-pay="${p.id}">${esc(p.name)}</button>`).join('');
  $('src-grid').innerHTML = INCOME_SOURCES.map(s =>
    `<button type="button" class="src-btn" data-src="${s.id}"><span class="ic">${s.icon}</span><span>${esc(s.name)}</span></button>`).join('');

  $('kind-toggle').addEventListener('click', e => {
    const b = e.target.closest('[data-kind]');
    if (!b || form.editId) return;   // בעריכה לא מחליפים סוג
    form.kind = b.dataset.kind;
    renderAdd();
  });
  $('src-grid').addEventListener('click', e => { const b = e.target.closest('.src-btn'); if (b) { form.source = b.dataset.src; renderAdd(); } });
  $('numpad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pressKey(b.dataset.k); });
  $('cat-grid').addEventListener('click', e => { const b = e.target.closest('.cat-btn'); if (b) { form.category = b.dataset.cat; renderAdd(); } });
  $('pay-row').addEventListener('click', e => { const b = e.target.closest('.pay-btn'); if (b) { form.payment = b.dataset.pay; renderAdd(); } });
  $('shared-chip').addEventListener('click', () => { form.shared = !form.shared; renderAdd(); });
  $('share-row').addEventListener('click', e => {
    const b = e.target.closest('[data-split]'); if (!b) return;
    if (b.dataset.split === 'custom') {
      const v = parseNum(prompt('כמה מזה החלק שלי?', String(myShare())) ?? '');
      if (v == null) return;
      form.split = 'custom'; form.customShare = round2(v);
    } else { form.split = Number(b.dataset.split); form.customShare = null; }
    renderAdd();
  });
  // תאריך: קיצורים, ורק "תאריך אחר" פותח את הבוחר של המכשיר
  $('date-chip').addEventListener('click', () => { $('date-row').classList.toggle('hidden'); renderAdd(); });
  $('date-row').addEventListener('click', e => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    form.date = daysAgo(Number(b.dataset.days));
    $('date-row').classList.add('hidden');
    renderAdd();
  });
  const onPick = e => {
    if (!e.target.value) return;
    form.date = e.target.value;
    e.target.blur();   // משחררים את הבוחר של iOS, אחרת הלחיצה הבאה לא נקלטת
    $('date-row').classList.add('hidden');
    renderAdd();
  };
  $('date-input').addEventListener('change', onPick);
  $('date-input').addEventListener('input', onPick);
  $('note-chip').addEventListener('click', () => { const n = $('note-input'); n.classList.toggle('hidden'); if (!n.classList.contains('hidden')) n.focus(); });
  $('note-input').addEventListener('input', e => { form.note = e.target.value; renderAdd(); });
  $('save-btn').addEventListener('click', saveExpense);
  $('edit-cancel').addEventListener('click', () => { resetForm(); showView('month'); });

  // מקלדת פיזית במחשב
  document.addEventListener('keydown', e => {
    if (currentView !== 'add' || e.target.tagName === 'INPUT') return;
    if (/^[0-9.]$/.test(e.key)) pressKey(e.key);
    else if (e.key === 'Backspace') pressKey('del');
    else if (e.key === 'Enter') saveExpense();
  });
}

function pressKey(k) {
  let s = form.amount;
  if (k === 'del') s = s.slice(0, -1);
  else if (k === '.') { if (!s.includes('.')) s = (s || '0') + '.'; }
  else {
    if (s === '0') s = '';
    const [, dec] = s.split('.');
    if (dec !== undefined && dec.length >= 2) return;
    if (s.replace('.', '').length >= 7) return;
    s += k;
  }
  form.amount = s;
  renderAdd();
}

function renderAdd() {
  const shown = form.amount || '0';
  const num = form.amount.includes('.') ? form.amount : Number(shown).toLocaleString('he-IL');
  $('amount-display').querySelector('.amount-num').textContent = num;
  $('amount-display').classList.toggle('empty', !form.amount);

  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === form.category));
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.toggle('active', b.dataset.pay === form.payment));

  $('shared-chip').setAttribute('aria-pressed', String(form.shared));
  $('share-row').classList.toggle('hidden', !form.shared);
  if (form.shared) {
    $('share-label').textContent = `החלק שלי: ${money(myShare())}`;
    document.querySelectorAll('[data-split]').forEach(b => b.classList.toggle('active', String(form.split) === b.dataset.split));
  }
  $('date-label').textContent = dateLabel(form.date);
  $('date-chip').classList.toggle('has-value', form.date !== todayStr());
  $('date-chip').setAttribute('aria-expanded', String(!$('date-row').classList.contains('hidden')));
  const quick = [0, 1, 2].find(n => daysAgo(n) === form.date);
  document.querySelectorAll('.date-opt[data-days]').forEach(b => b.classList.toggle('active', Number(b.dataset.days) === quick));
  $('date-other').classList.toggle('active', quick === undefined);
  if (document.activeElement !== $('date-input')) $('date-input').value = form.date;
  $('note-chip').classList.toggle('has-value', !!form.note.trim());
  $('note-chip').textContent = form.note.trim() ? 'הערה ✓' : 'הערה';

  const income = form.kind === 'income';
  document.querySelectorAll('#kind-toggle [data-kind]').forEach(b => b.classList.toggle('active', b.dataset.kind === form.kind));
  $('kind-toggle').classList.toggle('hidden', !!form.editId);
  $('cat-grid').classList.toggle('hidden', income);
  $('pay-row').classList.toggle('hidden', income);
  $('shared-chip').classList.toggle('hidden', income);
  if (income) $('share-row').classList.add('hidden');
  $('src-grid').classList.toggle('hidden', !income);
  document.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', b.dataset.src === form.source));

  $('save-btn').disabled = !(amountValue() > 0 && (income ? form.source : form.category));
  $('save-btn').textContent = form.editId ? 'עדכון' : 'שמירה';
  $('edit-bar').querySelector('span').textContent = income ? 'עריכת הכנסה' : 'עריכת הוצאה';
  $('edit-bar').classList.toggle('hidden', !form.editId);
}

function startEditIncome(id) {
  const inc = db.incomes[id];
  if (!inc) return;
  Object.assign(form, {
    kind: 'income', editId: id, amount: String(inc.amount), source: inc.source,
    shared: false, date: inc.date, note: inc.note || '',
  });
  $('note-input').value = form.note;
  $('note-input').classList.toggle('hidden', !form.note);
  showView('add');
}

function saveIncome() {
  const amount = round2(amountValue());
  if (!(amount > 0) || !form.source) return;
  const fields = { date: form.date, amount, source: form.source, note: form.note.trim() || null };
  const editing = !!form.editId;
  if (editing) putIncome({ ...db.incomes[form.editId], ...fields });
  else putIncome({ id: uid(), ...fields, deleted: false });
  persist();
  toast(`${editing ? 'עודכן' : 'נשמרה הכנסה'}: ${money(amount)} מ${SRC[form.source].name}`);
  if (editing) { viewMonth = monthOf(form.date); resetForm(); showView('month'); }
  else { resetForm(); render(); }
  sync();
}

// עריכה: טוענים הוצאה קיימת לתוך מסך הרישום
function startEdit(id) {
  const ex = db.expenses[id];
  if (!ex) return;
  let split = 3, customShare = null;
  if (ex.shared) {
    if (Math.abs(ex.my_share - round2(ex.amount / 3)) < 0.01) split = 3;
    else if (Math.abs(ex.my_share - round2(ex.amount / 2)) < 0.01) split = 2;
    else { split = 'custom'; customShare = ex.my_share; }
  }
  Object.assign(form, {
    editId: id, amount: String(ex.amount), category: ex.category, payment: ex.payment,
    shared: !!ex.shared, split, customShare, date: ex.date, note: ex.note || '',
  });
  $('note-input').value = form.note;
  $('note-input').classList.toggle('hidden', !form.note);
  showView('add');
}

function saveExpense() {
  if (form.kind === 'income') return saveIncome();
  const amount = round2(amountValue());
  if (!(amount > 0) || !form.category) return;
  const share = round2(myShare());
  const fields = {
    date: form.date, amount, my_share: share, category: form.category,
    payment: form.payment, shared: form.shared, note: form.note.trim() || null,
  };

  if (form.editId) {
    putExpense({ ...db.expenses[form.editId], ...fields });
    persist();
    toast(`עודכן: ${money(share)} ב${CAT[form.category].name}`);
    viewMonth = monthOf(form.date);
    resetForm();
    showView('month');
    sync();
    return;
  }

  putExpense({ id: uid(), ...fields, source: 'manual', deleted: false });
  prefs.lastPayment = form.payment; savePrefs();
  persist();

  const cat = CAT[form.category];
  let msg = `נשמר: ${money(share)} ב${cat.name}`;
  const budget = db.settings.budgets?.[form.category];
  if (budget) {
    const spent = monthExpenses(monthOf(form.date)).filter(e => e.category === form.category).reduce((s, e) => s + e.my_share, 0);
    msg += ` · ${money(spent)} / ${money(budget)}`;
  }
  toast(msg);
  resetForm();
  render();
  sync();
}

/* ================= מבט על החודש ================= */

let viewMonth = monthOf(todayStr());
const openCats = new Set();

function renderMonth() {
  const ym = viewMonth;
  $('month-title').textContent = monthTitle(ym);
  $('month-next').disabled = ym >= monthOf(todayStr());
  const items = monthExpenses(ym);
  const spent = items.reduce((s, e) => s + e.my_share, 0);
  $('month-total').textContent = money(spent);

  // הכנסות ונטו
  const incomes = monthIncomes(ym).sort((a, b) => b.date.localeCompare(a.date));
  const earned = incomes.reduce((s, i) => s + i.amount, 0);
  const net = round2(earned - spent);
  $('month-income').textContent = money(earned);
  $('month-net').textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + money(Math.abs(net));
  $('month-net').classList.toggle('pos', net > 0);
  $('month-net').classList.toggle('neg', net < 0);
  $('income-card').classList.toggle('hidden', !incomes.length);
  $('income-list').innerHTML = incomes.map(i => `
    <li>
      <span class="ic">${SRC[i.source]?.icon || '➕'}</span>
      <div class="i-main">
        <div><span class="i-amt">${money(i.amount)}</span> · ${esc(SRC[i.source]?.name || i.source)}</div>
        <div class="i-sub">${dateLabel(i.date)}${i.note ? ' · ' + esc(i.note) : ''}</div>
      </div>
      <button type="button" class="edit-btn" data-edit-income="${esc(i.id)}" aria-label="עריכה">✎</button>
      <button type="button" class="del-btn" data-del-income="${esc(i.id)}" aria-label="מחיקה">✕</button>
    </li>`).join('');

  const byCat = {};
  for (const e of items) (byCat[e.category] ||= []).push(e);
  const cats = CATEGORIES.filter(c => byCat[c.id])
    .map(c => ({ ...c, list: byCat[c.id].sort((a, b) => b.date.localeCompare(a.date)), sum: byCat[c.id].reduce((s, e) => s + e.my_share, 0) }))
    .sort((a, b) => b.sum - a.sum);

  $('cat-list').innerHTML = cats.length ? cats.map(c => {
    const budget = db.settings.budgets?.[c.id];
    let budgetHtml = '';
    if (budget) {
      const left = budget - c.sum, pct = c.sum / budget;
      const cls = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : '';
      budgetHtml = `<span class="budget ${cls}">${left >= 0 ? 'נשאר ' + money(left) : 'חריגה ' + money(-left)}</span>`;
    }
    const open = openCats.has(c.id);
    const rows = open ? `<ul class="items">${c.list.map(e => `
        <li>
          <div class="i-main">
            <div><span class="i-amt">${money(e.my_share)}</span>${e.shared ? ` <span class="muted">(מתוך ${money(e.amount)})</span>` : ''}</div>
            <div class="i-sub">${dateLabel(e.date)} · ${esc(PAY_NAME[e.payment] || e.payment)}${e.shared ? ' · משותף' : ''}${e.note ? ' · ' + esc(e.note) : ''}</div>
          </div>
          <button type="button" class="edit-btn" data-edit="${esc(e.id)}" aria-label="עריכה">✎</button>
          <button type="button" class="del-btn" data-del="${esc(e.id)}" aria-label="מחיקה">✕</button>
        </li>`).join('')}</ul>` : '';
    return `<li><button type="button" class="cat-row" data-open="${c.id}">
        <span class="ic">${c.icon}</span><span class="name">${esc(c.name)}</span>
        <span class="sum">${money(c.sum)}${budgetHtml}</span></button>${rows}</li>`;
  }).join('') : '<li class="empty-state">עוד אין הוצאות בחודש הזה</li>';

  const pb = partnerBalance();
  $('partner-balance').textContent = pb >= 0 ? money(pb) : `${money(-pb)} (אני חייבת)`;
  $('settle-btn').disabled = pb === 0;

  const b = db.settings.bank || {};
  $('bank-asof').textContent = b.asOf ? `נכון ל-${Number(b.asOf.slice(8))}.${Number(b.asOf.slice(5, 7))}.${b.asOf.slice(0, 4)}` : '';
  $('bank-balance').textContent = money(b.balance);
  $('bank-pending').textContent = money(b.pending);
  $('bank-available').textContent = money((b.balance || 0) - (b.pending || 0));
}

function buildMonthView() {
  $('month-prev').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, -1); renderMonth(); });
  $('month-next').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, 1); renderMonth(); });
  $('income-list').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-income]');
    if (edit) { startEditIncome(edit.dataset.editIncome); return; }
    const del = e.target.closest('[data-del-income]');
    if (!del) return;
    const inc = db.incomes[del.dataset.delIncome];
    if (inc && confirm(`למחוק הכנסה של ${money(inc.amount)} מ${SRC[inc.source]?.name || ''}?`)) {
      putIncome({ ...inc, deleted: true }); persist(); render(); sync();
    }
  });
  $('cat-list').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]');
    if (edit) { startEdit(edit.dataset.edit); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const ex = db.expenses[del.dataset.del];
      if (ex && confirm(`למחוק ${money(ex.my_share)} ב${CAT[ex.category]?.name || ''}?`)) {
        putExpense({ ...ex, deleted: true }); persist(); render(); sync();
      }
      return;
    }
    const row = e.target.closest('[data-open]');
    if (row) { const id = row.dataset.open; openCats.has(id) ? openCats.delete(id) : openCats.add(id); renderMonth(); }
  });
  $('settle-btn').addEventListener('click', () => {
    const pb = partnerBalance();
    const v = parseNum(prompt('כמה קיבלת מהשותפות?', String(pb)) ?? '');
    if (v == null || v === 0) return;
    putSettlement({ id: uid(), date: todayStr(), amount: round2(v), note: null, deleted: false });
    persist(); render(); sync();
    toast(`נרשמה התחשבנות: ${money(v)}`);
  });
}

/* ================= הגדרות ================= */

function renderSync() {
  const pending = db.queue.length;
  let text;
  if (cloud === 'local') text = 'הנתונים נשמרים רק במכשיר הזה (הענן עוד לא מחובר).';
  else if (cloud === 'offline') text = 'אין חיבור כרגע. ההוצאות נשמרות במכשיר ויעלו כשיחזור החיבור.';
  else if (!session) text = 'לא מחוברת. ההוצאות נשמרות במכשיר ויעלו אחרי הכניסה.';
  else if (syncState.status === 'syncing') text = 'מסנכרנת…';
  else if (syncState.status === 'error') text = `הסנכרון נכשל: ${syncState.error}`;
  else text = `מחוברת: ${session.user.email}` + (syncState.at ? ` · סונכרן ב-${pad(syncState.at.getHours())}:${pad(syncState.at.getMinutes())}` : '');
  if (pending && cloud !== 'local') text += ` · ${pending} שינויים ממתינים`;
  $('sync-detail').textContent = text;
  $('sync-btn').classList.toggle('hidden', cloud === 'local');
  $('sync-btn').textContent = session || cloud !== 'ready' ? 'סנכרון עכשיו' : 'כניסה';
  $('logout-btn').classList.toggle('hidden', !session);
  $('sync-dot').classList.toggle('hidden', cloud === 'local' || !(pending || syncState.status === 'error'));
}

function renderSettings() {
  renderSync();
  renderPush();
  const b = db.settings.bank || {};
  if (document.activeElement?.closest('#bank-form') == null) {
    $('set-balance').value = b.balance ?? '';
    $('set-pending').value = b.pending ?? '';
  }
  if (document.activeElement?.closest('#fixed-form') == null) {
    $('fixed-list').innerHTML = (db.settings.fixed || []).map((f, i) => `
      <label class="fixed-row"><span>${esc(f.name)} <span class="muted">· ${esc(CAT[f.category]?.name || '')}</span></span>
      <input type="text" inputmode="decimal" data-fixed="${i}" value="${esc(f.amount)}"></label>`).join('');
  }
}

function buildSettingsView() {
  $('sync-btn').addEventListener('click', () => { if (!session && cloud === 'ready') showView('login'); else sync(); });
  $('logout-btn').addEventListener('click', async () => {
    if (db.queue.length && !confirm('יש שינויים שעוד לא עלו לענן. להתנתק בכל זאת?')) return;
    await sb.auth.signOut(); session = null; render();
  });
  $('bank-form').addEventListener('submit', e => {
    e.preventDefault();
    const bal = parseNum($('set-balance').value), pen = parseNum($('set-pending').value);
    if (bal == null || pen == null) return toast('צריך מספר בשני השדות');
    db.settings.bank = { balance: bal, pending: pen, asOf: todayStr() };
    putSettings(); persist(); document.activeElement?.blur(); render(); sync();
    toast('היתרה עודכנה');
  });
  $('fixed-form').addEventListener('submit', e => {
    e.preventDefault();
    const inputs = [...document.querySelectorAll('[data-fixed]')];
    for (const inp of inputs) {
      const v = parseNum(inp.value);
      if (v == null || v < 0) return toast('צריך מספר בכל שדה');
      db.settings.fixed[Number(inp.dataset.fixed)].amount = round2(v);
    }
    putSettings(); persist(); document.activeElement?.blur(); render(); sync();
    toast('הקבועות עודכנו מהחודש הבא');
  });
}

/* ================= התראות (תזכורת ערב) ================= */

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
function b64uToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function swReady(ms = 4000) {
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('sw timeout')), ms))]);
}
async function currentPushSub() {
  try { return await (await swReady()).pushManager.getSubscription(); } catch (e) { return null; }
}

async function renderPush() {
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  let text, enable = false, active = false;
  if (!pushSupported()) {
    text = isIOS() ? 'כדי לקבל התראות צריך לפתוח את האפליקציה מהאייקון במסך הבית, לא מספארי.' : 'הדפדפן הזה לא תומך בהתראות.';
  } else if (!session) {
    text = 'צריך להתחבר כדי להפעיל התראות.';
  } else if (Notification.permission === 'denied') {
    text = 'ההתראות חסומות. אפשר לאשר אותן בהגדרות של האייפון ← עדכונים ← הוצאות.';
  } else if (await currentPushSub()) {
    text = 'פועל: כל ערב ב-21:00 תגיע תזכורת.'; active = true;
  } else {
    text = 'כבוי.'; enable = true;
  }
  $('push-detail').textContent = text;
  show('push-btn', enable); show('push-test-btn', active); show('push-off-btn', active);
}

async function enablePush() {
  try {
    const perm = await Notification.requestPermission();   // חייב לקרות ישר מהלחיצה
    if (perm !== 'granted') { toast('ההתראות לא אושרו'); return renderPush(); }
    const reg = await swReady();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(window.APP_CONFIG.vapidPublicKey) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions')
      .upsert({ endpoint: j.endpoint, user_id: session.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
    if (error) throw error;
    toast('ההתראות הופעלו');
  } catch (e) {
    console.error(e);
    toast('לא הצלחתי להפעיל: ' + (e.message || e));
  }
  renderPush();
}

async function disablePush() {
  const sub = await currentPushSub();
  if (sub) {
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  toast('ההתראות כובו');
  renderPush();
}

async function testPush() {
  try {
    const { data } = await sb.auth.getSession();
    const res = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/daily-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: window.APP_CONFIG.supabaseAnonKey, Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ test: true }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || res.status);
    const bad = (out.results || []).filter(r => r.status >= 300);
    if (!out.sent) toast('לא נמצא מכשיר רשום');
    else if (bad.length) toast(`השליחה נכשלה (${bad[0].status}) ${bad[0].detail || ''}`);
    else toast('נשלחה. ההתראה תגיע בעוד כמה שניות');
  } catch (e) {
    toast('השליחה נכשלה: ' + (e.message || e));
  }
}

function buildPushView() {
  $('push-btn').addEventListener('click', enablePush);
  $('push-off-btn').addEventListener('click', disablePush);
  $('push-test-btn').addEventListener('click', testPush);
}

/* ================= התחברות ================= */

function buildLoginView() {
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-error').classList.add('hidden');
    if (!sb) { $('login-error').textContent = 'אין חיבור לענן כרגע'; $('login-error').classList.remove('hidden'); return; }
    const { error } = await sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    if (error) {
      $('login-error').textContent = error.message === 'Invalid login credentials' ? 'המייל או הסיסמה לא נכונים' : error.message;
      $('login-error').classList.remove('hidden');
      return;
    }
    $('login-password').value = '';
    prefs.skipLogin = false; savePrefs();
    showView('add');
    sync();
  });
  $('login-skip').addEventListener('click', () => { prefs.skipLogin = true; savePrefs(); showView('add'); });
}

/* ================= ניווט ================= */

let currentView = 'add';
function showView(name) {
  currentView = name;
  for (const v of ['add', 'month', 'settings', 'login']) $('view-' + v).classList.toggle('hidden', v !== name);
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'month') viewMonth = viewMonth || monthOf(todayStr());
  render();
  window.scrollTo(0, 0);
}

function render() {
  renderAdd();
  if (currentView === 'month') renderMonth();
  if (currentView === 'settings') renderSettings();
  renderSync();
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ================= הפעלה ================= */

function start() {
  buildAddView(); buildMonthView(); buildSettingsView(); buildPushView(); buildLoginView();
  $('tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    if (form.editId) resetForm();   // יציאה מעריכה בלי לשמור
    if (b.dataset.view === 'month') viewMonth = monthOf(todayStr());
    showView(b.dataset.view);
  });
  // ?view=month פותח ישר את החודש (לקיצורים באייפון)
  const v = new URLSearchParams(location.search).get('view');
  showView(['month', 'settings'].includes(v) ? v : 'add');

  window.addEventListener('online', () => { if (cloud === 'offline') initCloud(); else sync(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (form.date < todayStr() && !form.amount) form.date = todayStr();   // חזרה לאפליקציה ביום חדש
    ensureFixed(); render(); sync();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  initCloud();
}

start();
