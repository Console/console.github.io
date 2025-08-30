// ChittyKitty — plain JS + IndexedDB offline app (with optional FX access key)
// Scoped Export/Import (all/current/selected); collision-safe importer; Manage toggle;
// Flush FX cache; edit/delete trips & members; edit expenses; quick-edit FX rate
// Members list shows per-member "Paid so far" (home currency), sorted ascending; updates on all expense/FX changes
// FIXES:
// - Reinstate renderTrips()
// - Deduplicate members in-memory to avoid duplicate rows
// - Add per-view token (state.viewToken) to prevent async/race UI stomping when switching trips
// - Retry FX now refreshes the current trip safely (only if still on same trip)

// ---------------- Utilities ----------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
const nowIso = () => new Date().toISOString();
const toLocalDateTimeValue = (d = new Date()) => {
  const pad = (x) => `${x}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const dateOnly = (iso) => iso.split('T')[0];
const uniqById = (arr) => Array.from(new Map(arr.map(x => [x.id, x])).values());

// Remember last participant selection per trip
const lastPartKey = (tripId) => `chittykitty_last_participants:${tripId}`;
function getLastParticipants(tripId) {
  try { const v = localStorage.getItem(lastPartKey(tripId)); return v ? JSON.parse(v) : null; } catch { return null; }
}
function setLastParticipants(tripId, arr) {
  try { localStorage.setItem(lastPartKey(tripId), JSON.stringify(arr)); } catch {}
}


const CURRENCIES = [
  "USD","EUR","GBP","AUD","CAD","CHF","CNY","JPY","SEK","NOK","DKK","PLN","CZK","HUF","RON","BGN","HRK","TRY","MXN","BRL","ARS","CLP","COP","PEN","ZAR","INR","IDR","MYR","PHP","SGD","KRW","NZD","AED","SAR","EGP","ILS","VND","THB","HKD","TWD"
];
const FX_BASE = "USD";

// ---------------- IndexedDB wrapper ----------------
const DB_NAME = 'chittykitty';
const DB_VERSION = 2; // includes fx_cache

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('members')) {
        const s = db.createObjectStore('members', { keyPath: 'id' });
        s.createIndex('by_trip', 'tripId');
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const s = db.createObjectStore('expenses', { keyPath: 'id' });
        s.createIndex('by_trip', 'tripId');
        s.createIndex('pending_fx', 'fxStatus');
      }
      if (!db.objectStoreNames.contains('ops')) db.createObjectStore('ops', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('fx_cache')) db.createObjectStore('fx_cache', { keyPath: 'key' }); // `${FX_BASE}:${YYYY-MM-DD}`
    };
    req.onsuccess = () => resolve(req.result);
  });
}
function tx(db, stores, mode = 'readonly') { return db.transaction(stores, mode); }
function getAll(store, idxName = null, key = null) {
  return new Promise((resolve, reject) => {
    const source = idxName ? store.index(idxName) : store;
    const req = key ? source.getAll(key) : source.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function getOne(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function put(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}
function del(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- App State ----------------
const state = {
  db: null,
  deviceId: null,
  currentTripId: null,
  viewToken: 0,          // <— token that increments every time a trip view is opened/refreshed
  members: [],
  expenses: [],
  trips: [],
  apiKey: null,          // exchangerate.host access_key
  editingExpenseId: null,
  manageOn: false,

  // Import UI
  pendingImportData: null,
  importFileName: null,
};

// ---------------- Operation Log ----------------
async function ensureDeviceId() {
  const t = tx(state.db, ['meta'], 'readwrite');
  const metaStore = t.objectStore('meta');
  const existing = await getOne(metaStore, 'deviceId');
  if (existing?.value) { state.deviceId = existing.value; return existing.value; }
  const id = uuid();
  await put(metaStore, { key: 'deviceId', value: id });
  state.deviceId = id;
  return id;
}
async function logOp({ type, entityType, entityId, ts, patch = null }) {
  const id = `${state.deviceId}:${type}:${entityType}:${entityId}:${ts}`;
  const t = tx(state.db, ['ops'], 'readwrite');
  await put(t.objectStore('ops'), { id, type, entityType, entityId, ts, patch });
  return id;
}

// ---------------- FX Handling ----------------
const FX_API = 'https://api.exchangerate.host';

// API key: chittykitty key only
function getStoredApiKey() {
  try {
    const ck = localStorage.getItem('chittykitty_fx_api_key');
    if (ck) return ck;
  } catch { return null; }
}
function setStoredApiKey(key) {
  try {
    if (key) localStorage.setItem('chittykitty_fx_api_key', key);
    else localStorage.removeItem('chittykitty_fx_api_key');
  } catch {}
  state.apiKey = key || null;
  $('#apiKeySavedBadge')?.classList.toggle('hidden', !state.apiKey);
  const input = $('#apiKeyInput');
  if (input && !document.activeElement.isEqualNode(input)) input.value = state.apiKey || '';
}

// Fetch USD-based daily table into cache; returns map {USD:1, EUR:x, ...}
async function getRatesForDateUSD(dateStr) {
  const cacheKey = `${FX_BASE}:${dateStr}`;
  // cache first
  {
    const t = tx(state.db, ['fx_cache']);
    const rec = await getOne(t.objectStore('fx_cache'), cacheKey);
    if (rec && rec.rates) return rec.rates;
  }
  if (!state.apiKey) throw new Error('FX: no access_key configured');
  if (!navigator.onLine) throw new Error('FX: offline and no cached rates');

  // API is constrained to USD source; fetch a daily USD->* table
  const symbols = CURRENCIES.filter(c => c !== FX_BASE).join(',');
  const url = `${FX_API}/historical?date=${encodeURIComponent(dateStr)}&currencies=${encodeURIComponent(symbols)}&access_key=${encodeURIComponent(state.apiKey)}`;

  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
  const data = await res.json();
  const quotes = data?.quotes;
  if (!quotes || typeof quotes !== 'object') throw new Error('FX: quotes missing');

  const rates = { [FX_BASE]: 1 };
  for (const code of CURRENCIES) {
    if (code === FX_BASE) continue;
    const key = `${FX_BASE}${code}`;
    if (quotes[key] != null) rates[code] = quotes[key];
  }

  const t = tx(state.db, ['fx_cache'], 'readwrite');
  await put(t.objectStore('fx_cache'), {
    key: cacheKey, base: FX_BASE, date: dateStr, rates, updatedAt: nowIso()
  });

  return rates;
}

async function fetchFxRate(dateISO, from, to) {
  if (from === to) return 1;
  const date = dateOnly(dateISO);
  const rates = await getRatesForDateUSD(date);
  const rFrom = from === FX_BASE ? 1 : rates[from];
  const rTo   = to   === FX_BASE ? 1 : rates[to];
  if (!rFrom || !rTo) throw new Error(`FX: missing USD rates for ${from} or ${to} on ${date}`);
  const rate = rTo / rFrom;
  return Math.round(rate * 1e8) / 1e8;
}

// cache-only read
async function getRatesFromCache(dateStr) {
  const t = tx(state.db, ['fx_cache']);
  const rec = await getOne(t.objectStore('fx_cache'), `${FX_BASE}:${dateStr}`);
  return rec?.rates || null;
}

// resolve pending using cache only (no long-lived write tx)
async function resolvePendingFromCacheForTrip(trip) {
  // 1) Read all trip expenses (readonly tx)
  const t1 = tx(state.db, ['expenses']);
  const all = await getAll(t1.objectStore('expenses').index('by_trip'), null, trip.id);

  // 2) Figure out which ones we can resolve from cache
  const updates = [];
  for (const e of all) {
    if (e.tripId !== trip.id || e.fxStatus !== 'pending') continue;
    const dateStr = dateOnly(e.dateISO);
    const rates = await getRatesFromCache(dateStr); // separate tx under the hood
    if (!rates) continue;

    const rFrom = e.currency === FX_BASE ? 1 : rates[e.currency];
    const rTo   = trip.homeCurrency === FX_BASE ? 1 : rates[trip.homeCurrency];
    if (!rFrom || !rTo) continue;

    const rate = Math.round((rTo / rFrom) * 1e8) / 1e8;
    updates.push({
      ...e,
      fxRate: rate,
      fxStatus: (e.currency === trip.homeCurrency) ? 'unneeded' : 'resolved',
      updatedAt: nowIso()
    });
  }

  // 3) Apply updates using short, isolated write txs to avoid TransactionInactiveError
  let resolved = 0;
  for (const upd of updates) {
    const t2 = tx(state.db, ['expenses'], 'readwrite');
    await put(t2.objectStore('expenses'), upd);
    await logOp({
      type: 'upsert',
      entityType: 'expense',
      entityId: upd.id,
      ts: upd.updatedAt,
      patch: { fxRate: upd.fxRate, fxStatus: upd.fxStatus }
    });
    resolved++;
  }

  return resolved;
}


// backfill pending with ≤1 request per date (no long-lived write tx)
async function backfillPendingFxForTrip(trip) {
  // 1) Read pending expenses
  const t1 = tx(state.db, ['expenses']);
  const all = await getAll(t1.objectStore('expenses').index('by_trip'), null, trip.id);
  const pend = all.filter(e => e.fxStatus === 'pending');

  // 2) Warm the USD-day tables once per date
  const dates = Array.from(new Set(pend.map(e => dateOnly(e.dateISO))));
  for (const d of dates) { try { await getRatesForDateUSD(d); } catch {} }

  // 3) Compute & persist each update in its own short write tx
  let updated = 0;
  for (const e of pend) {
    try {
      const rate = await fetchFxRate(e.dateISO, e.currency, trip.homeCurrency);
      const upd = {
        ...e,
        fxRate: rate,
        fxStatus: (e.currency === trip.homeCurrency) ? 'unneeded' : 'resolved',
        updatedAt: nowIso()
      };
      const t2 = tx(state.db, ['expenses'], 'readwrite');
      await put(t2.objectStore('expenses'), upd);
      await logOp({
        type: 'upsert',
        entityType: 'expense',
        entityId: upd.id,
        ts: upd.updatedAt,
        patch: { fxRate: upd.fxRate, fxStatus: upd.fxStatus }
      });
      updated++;
    } catch {
      // ignore per-item failures
    }
  }
  return updated;
}

// flush cache
async function flushFxCache() {
  const t = tx(state.db, ['fx_cache'], 'readwrite');
  const store = t.objectStore('fx_cache');
  const all = await getAll(store);
  for (const rec of all) await del(store, rec.key);
  return all.length;
}

// ---------------- Data CRUD ----------------
async function createTrip(name, homeCurrency) {
  const trip = { id: uuid(), name, homeCurrency, createdAt: nowIso(), updatedAt: nowIso() };
  const t = tx(state.db, ['trips'], 'readwrite');
  await put(t.objectStore('trips'), trip);
  await logOp({ type: 'upsert', entityType: 'trip', entityId: trip.id, ts: trip.updatedAt, patch: trip });
  return trip;
}
async function listTrips() {
  const t = tx(state.db, ['trips']);
  return await getAll(t.objectStore('trips'));
}
async function getTrip(tripId) {
  const t = tx(state.db, ['trips']);
  return await getOne(t.objectStore('trips'), tripId);
}
async function updateTrip(tripId, patch) {
  const t = tx(state.db, ['trips','expenses'], 'readwrite');
  const tripsStore = t.objectStore('trips');
  const expensesStore = t.objectStore('expenses');
  const trip = await getOne(tripsStore, tripId);
  if (!trip) throw new Error('Trip not found');
  const oldHome = trip.homeCurrency;
  Object.assign(trip, patch);
  trip.updatedAt = nowIso();
  await put(tripsStore, trip);
  await logOp({ type: 'upsert', entityType: 'trip', entityId: trip.id, ts: trip.updatedAt, patch });

  if (patch.homeCurrency && patch.homeCurrency !== oldHome) {
    const exps = await getAll(expensesStore.index('by_trip'), null, trip.id);
    for (const e of exps) {
      if (e.currency === trip.homeCurrency) { e.fxRate = 1; e.fxStatus = 'unneeded'; }
      else { e.fxRate = null; e.fxStatus = 'pending'; }
      e.updatedAt = nowIso();
      await put(expensesStore, e);
    }
  }
  return trip;
}
async function deleteTrip(tripId) {
  const t = tx(state.db, ['trips','members','expenses'], 'readwrite');
  const tripsStore = t.objectStore('trips');
  const membersStore = t.objectStore('members');
  const expensesStore = t.objectStore('expenses');
  const trip = await getOne(tripsStore, tripId);
  if (!trip) return;

  const mems = await getAll(membersStore.index('by_trip'), null, tripId);
  for (const m of mems) await del(membersStore, m.id);
  const exps = await getAll(expensesStore.index('by_trip'), null, tripId);
  for (const e of exps) await del(expensesStore, e.id);

  await del(tripsStore, tripId);
  await logOp({ type: 'delete', entityType: 'trip', entityId: tripId, ts: nowIso(), patch: null });
}

async function createMember(tripId, name) {
  const m = { id: uuid(), tripId, name, createdAt: nowIso(), updatedAt: nowIso() };
  const t = tx(state.db, ['members'], 'readwrite');
  await put(t.objectStore('members'), m);
  await logOp({ type: 'upsert', entityType: 'member', entityId: m.id, ts: m.updatedAt, patch: m });
  return m;
}
async function listMembers(tripId) {
  const t = tx(state.db, ['members']);
  return await getAll(t.objectStore('members').index('by_trip'), null, tripId);
}
async function updateMember(memberId, patch) {
  const t = tx(state.db, ['members'], 'readwrite');
  const store = t.objectStore('members');
  const m = await getOne(store, memberId);
  if (!m) throw new Error('Member not found');
  Object.assign(m, patch);
  m.updatedAt = nowIso();
  await put(store, m);
  await logOp({ type: 'upsert', entityType: 'member', entityId: m.id, ts: m.updatedAt, patch });
  return m;
}
async function deleteMember(memberId) {
  const t = tx(state.db, ['members','expenses'], 'readwrite');
  const mstore = t.objectStore('members');
  const estore = t.objectStore('expenses');
  const m = await getOne(mstore, memberId);
  if (!m) return false;
  const exps = await getAll(estore.index('by_trip'), null, m.tripId);
  const used = exps.some(e => e.payerId === memberId || (e.participants || []).includes(memberId));
  if (used) throw new Error('Cannot delete member: referenced by existing expenses.');
  await del(mstore, memberId);
  await logOp({ type: 'delete', entityType: 'member', entityId: memberId, ts: nowIso(), patch: null });
  return true;
}

async function createExpense(exp) {
  exp.id = uuid();
  exp.createdAt = nowIso();
  exp.updatedAt = exp.createdAt;
  const t = tx(state.db, ['expenses'], 'readwrite');
  await put(t.objectStore('expenses'), exp);
  await logOp({ type: 'upsert', entityType: 'expense', entityId: exp.id, ts: exp.updatedAt, patch: exp });
  return exp;
}
async function updateExpense(expId, patch) {
  const t = tx(state.db, ['expenses'], 'readwrite');
  const store = t.objectStore('expenses');
  const e = await getOne(store, expId);
  if (!e) throw new Error('Expense not found');
  Object.assign(e, patch);
  e.updatedAt = nowIso();
  await put(store, e);
  await logOp({ type: 'upsert', entityType: 'expense', entityId: e.id, ts: e.updatedAt, patch });
  return e;
}
async function listExpenses(tripId) {
  const t = tx(state.db, ['expenses']);
  return await getAll(t.objectStore('expenses').index('by_trip'), null, tripId);
}
async function deleteExpense(expenseId) {
  const t = tx(state.db, ['expenses'], 'readwrite');
  await del(t.objectStore('expenses'), expenseId);
  await logOp({ type: 'delete', entityType: 'expense', entityId: expenseId, ts: nowIso(), patch: null });
}

// ---------------- Settlement & Paid Totals ----------------
function computeSettlement(trip, members, expenses) {
  const home = trip.homeCurrency;
  const ids = members.map(m => m.id);
  const nameById = Object.fromEntries(members.map(m => [m.id, m.name]));
  const net = Object.fromEntries(ids.map(id => [id, 0]));

  let unresolved = 0;
  for (const e of expenses) {
    const rate = (e.currency === home) ? 1 : e.fxRate;
    if ((e.currency !== home) && (!rate || e.fxStatus === 'pending')) { unresolved++; continue; }
    const amountHome = Number(e.amount) * (rate || 1);
    const participants = e.participants && e.participants.length ? e.participants : [e.payerId];
    const share = amountHome / participants.length;
    for (const pid of participants) net[pid] -= share;
    net[e.payerId] += amountHome;
  }

  for (const k of Object.keys(net)) {
    net[k] = Math.round(net[k] * 100) / 100;
    if (Math.abs(net[k]) < 0.005) net[k] = 0;
  }

  const creditors = [];
  const debtors = [];
  for (const [id, v] of Object.entries(net)) {
    if (v > 0) creditors.push({ id, amt: v });
    else if (v < 0) debtors.push({ id, amt: -v });
  }
  creditors.sort((a,b)=>b.amt-a.amt);
  debtors.sort((a,b)=>b.amt-a.amt);

  const transfers = [];
  let i=0, j=0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0.004) {
      transfers.push({ from: d.id, to: c.id, amount: Math.round(pay*100)/100 });
      d.amt = Math.round((d.amt - pay)*100)/100;
      c.amt = Math.round((c.amt - pay)*100)/100;
    }
    if (d.amt <= 0.004) i++;
    if (c.amt <= 0.004) j++;
  }

  return {
    home,
    unresolved,
    netHuman: Object.entries(net).map(([id, v]) => ({ id, name: nameById[id], amount: Math.round(v*100)/100 })),
    transfers: transfers.map(t => ({ ...t, fromName: nameById[t.from], toName: nameById[t.to] }))
  };
}

// Running totals (Paid only, in home currency). Pending-FX expenses are excluded.
function computePaidPerMember(trip, members, expenses) {
  const cleanMembers = uniqById(members);
  const home = trip.homeCurrency;
  const paid = Object.fromEntries(cleanMembers.map(m => [m.id, 0]));
  for (const e of expenses) {
    const rate = (e.currency === home) ? 1 : e.fxRate;
    if ((e.currency !== home) && (!rate || e.fxStatus === 'pending')) continue;
    const amountHome = Number(e.amount) * (rate || 1);
    paid[e.payerId] = Math.round((paid[e.payerId] + amountHome)*100)/100;
  }
  const rows = cleanMembers.map(m => ({ id: m.id, name: m.name, paid: Math.round(paid[m.id]*100)/100 }));
  return { home, rows };
}

// ---------------- UI refs ----------------
const ui = {
  tripList: $('#tripList'),
  tripView: $('#tripView'),
  emptyState: $('#emptyState'),
  tripTitle: $('#tripTitle'),
  tripHomeCurrency: $('#tripHomeCurrency'),
  newTripForm: $('#newTripForm'),
  tripName: $('#tripName'),
  tripCurrency: $('#tripCurrency'),

  memberList: $('#memberList'),
  newMemberForm: $('#newMemberForm'),
  memberName: $('#memberName'),

  expenseForm: $('#expenseForm'),
  expenseFormTitle: $('#expenseFormTitle'),
  expSubmitBtn: $('#expSubmitBtn'),
  cancelEditExpenseBtn: $('#cancelEditExpenseBtn'),
  expDesc: $('#expDesc'),
  expAmount: $('#expAmount'),
  expCurrency: $('#expCurrency'),
  expPayer: $('#expPayer'),
  expWhen: $('#expWhen'),
  expFx: $('#expFx'),
  fxHint: $('#fxHint'),
  participantChecks: $('#participantChecks'),

  expenseBody: $('#expenseBody'),
  pendingFxBanner: $('#pendingFxBanner'),

  settlementArea: $('#settlementArea'),

  calcBtn: $('#calcBtn'),
  retryFxBtn: $('#retryFxBtn'),
  flushFxBtn: $('#flushFxBtn'),
  onlineStatus: $('#onlineStatus'),

  apiKeyForm: $('#apiKeyForm'),
  apiKeyInput: $('#apiKeyInput'),
  apiKeySavedBadge: $('#apiKeySavedBadge'),
  clearApiKeyBtn: $('#clearApiKeyBtn'),

  editTripBtn: $('#editTripBtn'),
  deleteTripBtn: $('#deleteTripBtn'),

  manageBtn: $('#manageBtn'),

  // Export UI
  exportPanel: $('#exportPanel'),
  exportTripChecks: $('#exportTripChecks'),
  doExportBtn: $('#doExportBtn'),

  // Import UI
  importInput: $('#importInput'),
  importPanel: $('#importPanel'),
  importTripChecks: $('#importTripChecks'),
  confirmImportBtn: $('#confirmImportBtn'),
  cancelImportBtn: $('#cancelImportBtn'),

  //Help UI
  helpBtn: $('#helpBtn'),
  helpModal: $('#helpModal'),
  closeHelpBtn: $('#closeHelpBtn'),

};

function fillCurrencySelect(sel, defaultCode = 'USD') {
  sel.innerHTML = '';
  for (const code of CURRENCIES) {
    const opt = document.createElement('option');
    opt.value = code; opt.textContent = code;
    if (code === defaultCode) opt.selected = true;
    sel.appendChild(opt);
  }
}
function setOnlineBadge() {
  ui.onlineStatus.textContent = navigator.onLine ? 'online' : 'offline';
  ui.onlineStatus.classList.toggle('online', navigator.onLine);
  ui.onlineStatus.classList.toggle('offline', !navigator.onLine);
}
function applyManageMode() {
  document.body.classList.toggle('manage-on', state.manageOn);
  ui.manageBtn.setAttribute('aria-pressed', String(state.manageOn));
  ui.manageBtn.textContent = state.manageOn ? 'Manage: ON' : 'Manage';
}

// ---------------- Trips list (reinstated) ----------------
async function renderTrips() {
  state.trips = await listTrips();
  ui.tripList.innerHTML = '';

  for (const t of state.trips) {
    const li = document.createElement('li');

    const title = document.createElement('div');
    title.innerHTML = `<strong>${t.name}</strong><div class="muted">${t.homeCurrency}</div>`;

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'ghost small';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openTrip(t.id));

    const editBtn = document.createElement('button');
    editBtn.className = 'ghost small manage-only';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => onEditTrip(t.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'danger small manage-only';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete trip "${t.name}" and all its data?`)) return;
      await deleteTrip(t.id);
      if (state.currentTripId === t.id) {
        state.currentTripId = null;
        ui.tripView.classList.add('hidden');
      }
      await renderTrips();
    });

    actions.append(openBtn, editBtn, delBtn);
    li.append(title, actions);
    ui.tripList.appendChild(li);
  }

  ui.emptyState.classList.toggle('hidden', state.trips.length !== 0);

  if (ui.exportPanel?.open) populateExportTripChecks();
}

// ---------------- Members rendering (Paid & sorting, with de-dup) ----------------
async function renderMembers(trip = null) {
  if (!state.currentTripId) { ui.memberList.innerHTML = ''; return; }
  if (!trip) trip = await getTrip(state.currentTripId);

  // de-dup in-memory list defensively
  state.members = uniqById(state.members);

  ui.memberList.innerHTML = '';

  const { home, rows } = computePaidPerMember(trip, state.members, state.expenses);
  const sorted = rows.slice().sort((a,b) => a.paid - b.paid);

  const frag = document.createDocumentFragment();
  for (const r of sorted) {
    const m = state.members.find(x => x.id === r.id);
    const li = document.createElement('li');

    const nameDiv = document.createElement('div');
    nameDiv.innerHTML = `<strong>${m.name}</strong>`;

    const amtDiv = document.createElement('div');
    amtDiv.className = 'num muted';
    amtDiv.textContent = `${fmt(r.paid)} ${home}`;

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const ed = document.createElement('button');
    ed.className = 'ghost small manage-only';
    ed.textContent = 'Edit';
    ed.addEventListener('click', async () => {
      const newName = prompt('Rename member:', m.name);
      if (!newName) return;
      await updateMember(m.id, { name: newName.trim() });
      state.members = uniqById(await listMembers(state.currentTripId));
      renderMembers(trip);
      renderExpenseForm(trip);
    });

    const del = document.createElement('button');
    del.className = 'danger small manage-only';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      try {
        await deleteMember(m.id);
        state.members = uniqById(await listMembers(state.currentTripId));
        renderMembers(trip);
        renderExpenseForm(trip);
      } catch (e) {
        alert(e.message || 'Cannot delete member.');
      }
    });

    actions.append(ed, del);
    li.append(nameDiv, amtDiv, actions);
    frag.appendChild(li);
  }
  ui.memberList.replaceChildren(frag);
}

// ---------------- Expenses list ----------------
function renderExpenseForm(trip) {
  fillCurrencySelect(ui.expCurrency, trip.homeCurrency);
  ui.expPayer.innerHTML = '';
  state.members = uniqById(state.members);
  for (const m of state.members) {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.name;
    ui.expPayer.appendChild(opt);
  }
  ui.participantChecks.innerHTML = '';
  for (const m of state.members) {
    const id = `p_${m.id}`;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${m.id}" id="${id}"><span>${m.name}</span>`;
    ui.participantChecks.appendChild(label);
  }

  // NEW: default selection logic
  const saved = getLastParticipants(trip.id);
  if (saved && saved.length) {
    // Apply last used selection for this trip
    $$('#participantChecks input[type=checkbox]').forEach(cb => cb.checked = saved.includes(cb.value));
  } else {
    // First time: ALL ON
    $$('#participantChecks input[type=checkbox]').forEach(cb => cb.checked = true);
  }

  // Ensure payer is included
  const payerId = ui.expPayer.value;
  const payerCb = $(`#participantChecks input[value="${payerId}"]`);
  if (payerCb) payerCb.checked = true;

  ui.expWhen.value = toLocalDateTimeValue(new Date());
  ui.expFx.value = '';
  ui.fxHint.textContent = `If left blank, the app will fetch the ${ui.expCurrency.value}→${trip.homeCurrency} rate for the selected date.`;
}

function expenseRow(trip, e) {
  const payer = state.members.find(m => m.id === e.payerId)?.name || '—';
  const partNames = (e.participants || []).map(pid => state.members.find(m => m.id === pid)?.name || pid);
  const fxTag = (e.currency === trip.homeCurrency)
    ? `<span class="tag ok">home=1</span>`
    : (e.fxStatus === 'pending' ? `<span class="tag warn">pending</span>` :
      e.fxRate ? `<span class="tag ok">${fmt(e.fxRate)}</span>` : `<span class="tag danger">n/a</span>`);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${e.description}</strong></td>
    <td class="num">${fmt(e.amount)}</td>
    <td>${e.currency}</td>
    <td>${payer}</td>
    <td>${new Date(e.dateISO).toLocaleString()}</td>
    <td>${partNames.join(', ')}</td>
    <td>${fxTag}</td>
    <td class="row-actions"></td>
  `;

  const actions = tr.querySelector('.row-actions');

  const editBtn = document.createElement('button');
  editBtn.className = 'ghost small manage-only';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => beginEditExpense(trip, e));

  const fxBtn = document.createElement('button');
  fxBtn.className = 'ghost small manage-only';
  fxBtn.textContent = 'FX';
  fxBtn.title = 'Set manual FX rate or clear';
  fxBtn.addEventListener('click', async () => {
    const val = prompt(`Enter manual FX rate (${e.currency} → ${trip.homeCurrency}). Leave blank to clear & mark pending.`, e.fxStatus === 'manual' && e.fxRate ? String(e.fxRate) : '');
    if (val === null) return;
    let patch = {};
    if (val.trim() === '') {
      if (e.currency === trip.homeCurrency) { patch.fxRate = 1; patch.fxStatus = 'unneeded'; }
      else { patch.fxRate = null; patch.fxStatus = 'pending'; }
    } else {
      const num = Number(val);
      if (!(num > 0)) { alert('Invalid FX rate'); return; }
      patch.fxRate = num; patch.fxStatus = 'manual';
    }
    await updateExpense(e.id, patch);
    state.expenses = await listExpenses(trip.id);
    renderExpenses(trip);
    renderMembers(trip); // refresh paid totals/order
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'danger small manage-only';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(e.id);
    state.expenses = await listExpenses(trip.id);
    renderExpenses(trip);
    renderMembers(trip); // refresh paid totals/order
  });

  actions.append(editBtn, fxBtn, delBtn);
  return tr;
}

function renderExpenses(trip) {
  ui.expenseBody.innerHTML = '';
  let hasPending = false;
  for (const e of state.expenses.sort((a,b)=> new Date(a.dateISO)-new Date(b.dateISO))) {
    if (e.fxStatus === 'pending') hasPending = true;
    ui.expenseBody.appendChild(expenseRow(trip, e));
  }
  ui.pendingFxBanner.classList.toggle('hidden', !hasPending);
}

// ---------------- Expense edit mode ----------------
function beginEditExpense(trip, e) {
  state.editingExpenseId = e.id;
  ui.expenseFormTitle.textContent = 'Edit Expense';
  ui.expSubmitBtn.textContent = 'Save Changes';
  ui.cancelEditExpenseBtn.classList.remove('hidden');

  ui.expDesc.value = e.description;
  ui.expAmount.value = e.amount;
  ui.expCurrency.value = e.currency;
  ui.expPayer.value = e.payerId;
  ui.expWhen.value = toLocalDateTimeValue(new Date(e.dateISO));
  ui.expFx.value = e.fxStatus === 'manual' && e.fxRate ? e.fxRate : '';

  $$('#participantChecks input[type=checkbox]').forEach(cb => cb.checked = false);
  (e.participants || []).forEach(pid => {
    const cb = $(`#participantChecks input[value="${pid}"]`);
    if (cb) cb.checked = true;
  });
  const payerCb = $(`#participantChecks input[value="${e.payerId}"]`);
  if (payerCb) payerCb.checked = true;

  const home = $('#tripHomeCurrency').textContent || 'USD';
  ui.fxHint.textContent = `If left blank, the app will fetch the ${ui.expCurrency.value}→${home} rate for the selected date.`;
}

function resetExpenseEditMode() {
  state.editingExpenseId = null;
  ui.expenseFormTitle.textContent = 'Add Expense';
  ui.expSubmitBtn.textContent = 'Add Expense';
  ui.cancelEditExpenseBtn.classList.add('hidden');
  ui.expDesc.value = '';
  ui.expAmount.value = '';
  ui.expFx.value = '';
  ui.expWhen.value = toLocalDateTimeValue(new Date());
  $$('#participantChecks input[type=checkbox]').forEach(cb => cb.checked = false);
}

// ---------------- Export UI helpers ----------------
function populateExportTripChecks() {
  if (!ui.exportTripChecks) return;
  ui.exportTripChecks.innerHTML = '';
  for (const t of state.trips) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${t.id}"><span>${t.name}</span>`;
    ui.exportTripChecks.appendChild(label);
  }
}
function getExportScope() {
  const r = $$('input[name="exportScope"]:checked', ui.exportPanel)[0];
  return r ? r.value : 'all';
}
function toggleExportChecks() {
  if (!ui.exportTripChecks) return;
  const show = getExportScope() === 'selected';
  ui.exportTripChecks.classList.toggle('hidden', !show);
}

// ---------------- Scoped Export helpers ----------------
async function exportBundleForTrips(tripIds) {
  const t = tx(state.db, ['trips','members','expenses','ops','meta','fx_cache']);
  const tripsStore = t.objectStore('trips');
  const membersStore = t.objectStore('members');
  const expensesStore = t.objectStore('expenses');
  const opsStore = t.objectStore('ops');
  const metaStore = t.objectStore('meta');
  const fxStore = t.objectStore('fx_cache');

  const trips = [];
  for (const id of tripIds) {
    const tr = await getOne(tripsStore, id);
    if (tr) trips.push(tr);
  }

  const members = [];
  const expenses = [];
  for (const id of tripIds) {
    const m = await getAll(membersStore.index('by_trip'), null, id);
    members.push(...m);
    const e = await getAll(expensesStore.index('by_trip'), null, id);
    expenses.push(...e);
  }

  const memberIds = new Set(members.map(m => m.id));
  const expenseIds = new Set(expenses.map(e => e.id));
  const tripIdSet = new Set(tripIds);

  const allOps = await getAll(opsStore);
  const ops = allOps.filter(op =>
    (op.entityType === 'trip' && tripIdSet.has(op.entityId)) ||
    (op.entityType === 'member' && memberIds.has(op.entityId)) ||
    (op.entityType === 'expense' && expenseIds.has(op.entityId))
  );

  const fxKeys = new Set(expenses.map(e => `${FX_BASE}:${dateOnly(e.dateISO)}`));
  const fx_cache = [];
  for (const key of fxKeys) {
    const rec = await getOne(fxStore, key);
    if (rec) fx_cache.push(rec);
  }

  const meta = await getAll(metaStore);

  return {
    version: 2,
    exportedAt: nowIso(),
    deviceId: state.deviceId,
    meta, trips, members, expenses, ops, fx_cache
  };
}

// ---------------- Collision-safe Import (supports subset) ----------------
async function importJsonCollisionSafe(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid JSON');

  const t = tx(state.db, ['trips','members','expenses','ops','fx_cache'], 'readwrite');
  const stores = {
    trips: t.objectStore('trips'),
    members: t.objectStore('members'),
    expenses: t.objectStore('expenses'),
    ops: t.objectStore('ops'),
    fx_cache: t.objectStore('fx_cache'),
  };

  const [existingTrips, existingMembers, existingExpenses] = await Promise.all([
    getAll(stores.trips), getAll(stores.members), getAll(stores.expenses)
  ]);
  const tripIds = new Set(existingTrips.map(x => x.id));
  const memberIds = new Set(existingMembers.map(x => x.id));
  const expenseIds = new Set(existingExpenses.map(x => x.id));

  const tripIdMap = new Map();
  const memberIdMap = new Map();
  const expenseIdMap = new Map();

  if (Array.isArray(data.ops)) for (const op of data.ops) { try { await put(stores.ops, op); } catch {} }
  if (Array.isArray(data.fx_cache)) for (const item of data.fx_cache) { try { await put(stores.fx_cache, item); } catch {} }

  const incomingTrips = Array.isArray(data.trips) ? data.trips.slice() : [];
  for (const tr of incomingTrips) {
    const originalId = tr.id;
    let newId = originalId;

    if (tripIds.has(originalId)) {
      const existing = existingTrips.find(x => x.id === originalId);
      const looksSame = existing && existing.name === tr.name && existing.homeCurrency === tr.homeCurrency;
      if (!looksSame) newId = uuid();
    }

    if (newId !== originalId) { tripIdMap.set(originalId, newId); tr.id = newId; }
    else { tripIdMap.set(originalId, originalId); }

    tr.updatedAt = tr.updatedAt || nowIso();
    await put(stores.trips, tr);
    tripIds.add(tr.id);
  }

  const incomingMembers = Array.isArray(data.members) ? data.members.slice() : [];
  for (const m of incomingMembers) {
    const originalId = m.id;
    m.tripId = tripIdMap.get(m.tripId) || m.tripId;

    let newId = originalId;
    if (memberIds.has(originalId)) newId = uuid();

    if (newId !== originalId) { memberIdMap.set(originalId, newId); m.id = newId; }
    else { memberIdMap.set(originalId, originalId); }

    m.updatedAt = m.updatedAt || nowIso();
    await put(stores.members, m);
    memberIds.add(m.id);
  }

  const incomingExpenses = Array.isArray(data.expenses) ? data.expenses.slice() : [];
  for (const e of incomingExpenses) {
    const originalId = e.id;
    e.tripId = tripIdMap.get(e.tripId) || e.tripId;
    if (e.payerId && memberIdMap.has(e.payerId)) e.payerId = memberIdMap.get(e.payerId);
    if (Array.isArray(e.participants) && e.participants.length) {
      e.participants = e.participants.map(pid => memberIdMap.get(pid) || pid);
    }

    let newId = originalId;
    if (expenseIds.has(originalId)) newId = uuid();

    if (newId !== originalId) { expenseIdMap.set(originalId, newId); e.id = newId; }
    else { expenseIdMap.set(originalId, originalId); }

    e.updatedAt = e.updatedAt || nowIso();
    await put(stores.expenses, e);
    expenseIds.add(e.id);
  }
}

// ---------------- Event Handlers ----------------
ui.manageBtn?.addEventListener('click', () => { state.manageOn = !state.manageOn; applyManageMode(); });

// -----------------Help Handlers -----------------
function openHelp() { ui.helpModal?.classList.remove('hidden'); }
function closeHelp() { ui.helpModal?.classList.add('hidden'); }

ui.helpBtn?.addEventListener('click', openHelp);
ui.closeHelpBtn?.addEventListener('click', closeHelp);
// Click backdrop to close
ui.helpModal?.addEventListener('click', (e) => { if (e.target === ui.helpModal) closeHelp(); });
// ESC to close
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHelp(); });
// ----------------- End Help Handlers -----------------

ui.newTripForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = ui.tripName.value.trim();
  const cur = ui.tripCurrency.value;
  if (!name) return;
  const trip = await createTrip(name, cur);
  ui.tripName.value = '';
  await renderTrips();
  await openTrip(trip.id);
});

async function onEditTrip(tripId) {
  const trip = await getTrip(tripId);
  const name = prompt('Trip name:', trip.name);
  if (name === null) return;
  let home = prompt(`Home currency (${CURRENCIES.join(', ')}):`, trip.homeCurrency);
  if (home === null) return;
  home = home.trim().toUpperCase();
  if (!CURRENCIES.includes(home)) { alert('Invalid currency code.'); return; }

  await updateTrip(tripId, { name: name.trim(), homeCurrency: home });
  await renderTrips();
  if (state.currentTripId === tripId) await openTrip(tripId);
}
ui.editTripBtn?.addEventListener('click', async () => { if (state.currentTripId) await onEditTrip(state.currentTripId); });
ui.deleteTripBtn?.addEventListener('click', async () => {
  if (!state.currentTripId) return;
  const cur = await getTrip(state.currentTripId);
  if (!confirm(`Delete trip "${cur.name}" and all its data?`)) return;
  await deleteTrip(state.currentTripId);
  state.currentTripId = null;
  ui.tripView.classList.add('hidden');
  await renderTrips();
});

ui.newMemberForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = ui.memberName.value.trim();
  if (!name || !state.currentTripId) return;
  await createMember(state.currentTripId, name);
  ui.memberName.value = '';
  state.members = uniqById(await listMembers(state.currentTripId));
  const trip = await getTrip(state.currentTripId);
  renderMembers(trip);
  renderExpenseForm(trip);
});

ui.expenseForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const trip = await getTrip(state.currentTripId);
  const description = ui.expDesc.value.trim();
  const amount = Number(ui.expAmount.value);
  const currency = ui.expCurrency.value;
  const payerId = ui.expPayer.value;
  const dateISO = new Date(ui.expWhen.value).toISOString();
  const manualFx = ui.expFx.value ? Number(ui.expFx.value) : null;

  let participants = $$('#participantChecks input[type=checkbox]:checked').map(c => c.value);
  if (!participants.includes(payerId)) participants.push(payerId);
  setLastParticipants(trip.id, participants);

  if (!state.members.length) { alert('Add at least one member'); return; }

  let fxRate = null, fxStatus = 'pending';
  if (currency === trip.homeCurrency) { fxRate = 1; fxStatus = 'unneeded'; }
  else if (manualFx && manualFx > 0) { fxRate = manualFx; fxStatus = 'manual'; }
  else if (navigator.onLine) { try { fxRate = await fetchFxRate(dateISO, currency, trip.homeCurrency); fxStatus = 'resolved'; } catch { fxRate = null; fxStatus = 'pending'; } }
  else { fxRate = null; fxStatus = 'pending'; }

  if (state.editingExpenseId) {
    await updateExpense(state.editingExpenseId, { description, amount, currency, payerId, dateISO, fxRate, fxStatus, participants });
  } else {
    await createExpense({ tripId: trip.id, description, amount, currency, payerId, dateISO, fxRate, fxStatus, participants });
  }

  resetExpenseEditMode();
  state.expenses = await listExpenses(trip.id);
  renderExpenses(trip);
  renderMembers(trip); // update paid totals/order
});
ui.cancelEditExpenseBtn?.addEventListener('click', () => { resetExpenseEditMode(); });

ui.expCurrency?.addEventListener('change', () => {
  const home = $('#tripHomeCurrency').textContent || 'USD';
  ui.fxHint.textContent = `If left blank, the app will fetch the ${ui.expCurrency.value}→${home} rate for the selected date.`;
});
ui.expPayer?.addEventListener('change', () => {
  const payerId = ui.expPayer.value;
  const cb = $(`#participantChecks input[value="${payerId}"]`);
  if (cb) cb.checked = true;
});

ui.calcBtn?.addEventListener('click', async () => {
  const myToken = state.viewToken;  // guard
  const trip = await getTrip(state.currentTripId);
  await resolvePendingFromCacheForTrip(trip);
  if (myToken !== state.viewToken) return; // user switched trips mid-flight

  state.expenses = await listExpenses(trip.id);
  if (myToken !== state.viewToken) return;

  const result = computeSettlement(trip, state.members, state.expenses);
  const home = result.home;
  const unresolved = result.unresolved;

  const balanceCards = result.netHuman.map(n => `
    <div class="card"><strong>${n.name}</strong><div class="muted">Net: ${fmt(n.amount)} ${home}</div></div>
  `).join('');

  const transferList = result.transfers.length
    ? `<ul>${result.transfers.map(t => `<li>${t.fromName} → ${t.toName}: <strong>${fmt(t.amount)} ${home}</strong></li>`).join('')}</ul>`
    : `<div class="muted">No transfers needed 🎉</div>`;

  ui.settlementArea.innerHTML = `
    <div class="grid">
      <div>
        <h4>Balances</h4>
        <div class="grid" style="grid-template-columns:1fr 1fr">${balanceCards}</div>
      </div>
      <div>
        <h4>Transfers</h4>
        ${transferList}
        ${unresolved ? `<div class="banner" style="margin-top:10px">${unresolved} expense(s) skipped due to pending FX.</div>` : ''}
      </div>
    </div>
  `;

  renderMembers(trip); // keep member totals in sync after pending→resolved from cache
});

ui.retryFxBtn?.addEventListener('click', async () => {
  if (!state.currentTripId) return;
  const myToken = state.viewToken;  // guard this run
  const trip = await getTrip(state.currentTripId);

  // 1) Fetch & update all pendings
  const updated = await backfillPendingFxForTrip(trip);

  // 2) As a second pass, resolve any still-pending from cache
  await resolvePendingFromCacheForTrip(trip);

  // If user switched trips while we worked, do nothing further.
  if (myToken !== state.viewToken) return;

  // 3) Hard refresh just this trip view to ensure everything is consistent
  await openTrip(state.currentTripId);

  if (updated) alert(`Resolved FX for ${updated} expense(s).`);
});

ui.flushFxBtn?.addEventListener('click', async () => {
  if (!confirm('Flush (clear) all cached FX tables? You can backfill again later.')) return;
  const n = await flushFxCache();
  alert(`Flushed ${n} cached FX day(s).`);
});

/* Export panel */
ui.exportPanel?.addEventListener('toggle', () => {
  if (ui.exportPanel.open) {
    populateExportTripChecks();
    toggleExportChecks();
  }
});
ui.exportPanel?.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'exportScope') toggleExportChecks();
});
ui.doExportBtn?.addEventListener('click', async () => {
  if (!state.trips.length) { alert('No trips to export.'); return; }
  const scope = getExportScope();
  let tripIds = [];
  if (scope === 'all') {
    tripIds = state.trips.map(t => t.id);
  } else if (scope === 'current') {
    if (!state.currentTripId) { alert('Open a trip first, or choose another scope.'); return; }
    tripIds = [state.currentTripId];
  } else {
    const checked = $$( 'input[type="checkbox"]:checked', ui.exportTripChecks).map(cb => cb.value);
    if (!checked.length) { alert('Select at least one trip.'); return; }
    tripIds = checked;
  }

  const data = await exportBundleForTrips(tripIds);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chittykitty_export_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 100);

  ui.exportPanel.open = false;
});

/* Import flow with subset selection */
ui.importInput?.addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    state.importFileName = file.name;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.trips) || !data.trips.length) {
      await importJsonCollisionSafe(data);
      await renderTrips();
      if (state.currentTripId) await openTrip(state.currentTripId);
      alert('Import complete.');
      return;
    }
    openImportPanelForData(data);
  } catch (e) {
    console.error(e);
    alert('Import failed: ' + e.message);
  } finally {
    ev.target.value = '';
  }
});

// Import subset UI helpers
function openImportPanelForData(data) {
  state.pendingImportData = data;
  if (!ui.importPanel) {
    importJsonCollisionSafe(data).then(renderTrips);
    return;
  }
  ui.importTripChecks.innerHTML = '';
  const trips = data.trips || [];
  for (const t of trips) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${t.id}" checked><span>${t.name}</span>`;
    ui.importTripChecks.appendChild(label);
  }
  const radios = $$('input[name="importScope"]');
  if (radios[0]) radios[0].checked = true; // all
  ui.importTripChecks.classList.add('hidden');
  ui.importPanel.classList.remove('hidden');
}
function getImportScope() {
  const r = $$('input[name="importScope"]:checked')[0];
  return r ? r.value : 'all';
}
ui.importPanel?.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'importScope') {
    const show = getImportScope() === 'selected';
    ui.importTripChecks.classList.toggle('hidden', !show);
  }
});
ui.cancelImportBtn?.addEventListener('click', () => {
  state.pendingImportData = null;
  ui.importPanel.classList.add('hidden');
});
ui.confirmImportBtn?.addEventListener('click', async () => {
  if (!state.pendingImportData) { ui.importPanel.classList.add('hidden'); return; }
  const scope = getImportScope();
  let tripIds = [];
  if (scope === 'all') {
    tripIds = (state.pendingImportData.trips || []).map(t => t.id);
  } else {
    const checked = $$('input[type="checkbox"]:checked', ui.importTripChecks).map(cb => cb.value);
    if (!checked.length) { alert('Select at least one trip.'); return; }
    tripIds = checked;
  }
  const data = state.pendingImportData;
  const trips = (data.trips || []).filter(tr => tripIds.includes(tr.id));
  const members = (data.members || []).filter(m => tripIds.includes(m.tripId));
  const expenses = (data.expenses || []).filter(e => tripIds.includes(e.tripId));
  const memberIds = new Set(members.map(m => m.id));
  const expenseIds = new Set(expenses.map(e => e.id));
  const ops = (data.ops || []).filter(op =>
    (op.entityType === 'trip' && tripIds.includes(op.entityId)) ||
    (op.entityType === 'member' && memberIds.has(op.entityId)) ||
    (op.entityType === 'expense' && expenseIds.has(op.entityId))
  );
  const fxKeys = new Set(expenses.map(e => `${FX_BASE}:${dateOnly(e.dateISO)}`));
  const fx_cache = (data.fx_cache || []).filter(rec => fxKeys.has(rec.key));
  const subset = { version: data.version || 2, exportedAt: nowIso(), deviceId: data.deviceId || '', meta: data.meta || [], trips, members, expenses, ops, fx_cache };

  try {
    await importJsonCollisionSafe(subset);
    await renderTrips();
    alert('Import complete.');
  } catch (e) {
    console.error(e);
    alert('Import failed: ' + e.message);
  } finally {
    state.pendingImportData = null;
    ui.importPanel.classList.add('hidden');
  }
});

/***** API key form *****/
ui.apiKeyForm?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const key = ui.apiKeyInput.value.trim();
  setStoredApiKey(key || null);
  if (key) { ui.apiKeySavedBadge.textContent = 'key saved'; ui.apiKeySavedBadge.classList.remove('hidden'); }
  else { ui.apiKeySavedBadge.classList.add('hidden'); }
});
ui.clearApiKeyBtn?.addEventListener('click', () => {
  setStoredApiKey(null);
  ui.apiKeyInput.value = '';
  ui.apiKeySavedBadge.classList.add('hidden');
});

/***** Online/offline *****/
// Guard against repainting an old trip after reconnect fetch finishes
window.addEventListener('online', async () => {
  setOnlineBadge();
  if (!state.currentTripId) return;
  const myToken = state.viewToken;
  const trip = await getTrip(state.currentTripId);
  await backfillPendingFxForTrip(trip);
  await resolvePendingFromCacheForTrip(trip);
  if (myToken !== state.viewToken) return;
  await openTrip(state.currentTripId);
});
window.addEventListener('offline', setOnlineBadge);

// ---------------- Init ----------------
(async function init(){
  fillCurrencySelect($('#tripCurrency'), 'USD');
  fillCurrencySelect($('#expCurrency'), 'USD');
  setOnlineBadge();

  state.db = await openDB();
  await ensureDeviceId();

  state.apiKey = getStoredApiKey();
  if (ui.apiKeyInput) ui.apiKeyInput.value = state.apiKey || '';
  if (ui.apiKeySavedBadge) ui.apiKeySavedBadge.classList.toggle('hidden', !state.apiKey);

  applyManageMode(); // default hidden

  await renderTrips();
  if (state.trips.length) openTrip(state.trips[0].id);
})();

// ---------------- Open trip (token-guarded) ----------------
async function openTrip(tripId) {
  state.currentTripId = tripId;
  state.viewToken += 1;           // bump token for this view
  const myToken = state.viewToken;

  const trip = await getTrip(tripId);
  if (!trip) return;
  // Early set of header (safe)
  ui.tripTitle.textContent = trip.name;
  ui.tripHomeCurrency.textContent = trip.homeCurrency;

  state.members = uniqById(await listMembers(tripId));
  state.expenses = await listExpenses(tripId);

  // Resolve from cache synchronously for this trip (no network)
  await resolvePendingFromCacheForTrip(trip);
  if (myToken !== state.viewToken) return;

  state.expenses = await listExpenses(tripId);
  if (myToken !== state.viewToken) return;

  await renderMembers(trip);         // shows paid & ascending order
  if (myToken !== state.viewToken) return;

  renderExpenseForm(trip);
  renderExpenses(trip);
  resetExpenseEditMode();
  ui.tripView.classList.remove('hidden');
  ui.settlementArea.innerHTML = `<div class="muted">Press “Calculate Settlement” to compute balances.</div>`;
}
