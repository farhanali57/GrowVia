const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app            = express();
const PORT           = process.env.PORT           || 3000;
const ADMIN_USER     = process.env.ADMIN_USER     || 'admin';
const ADMIN_PASS     = process.env.ADMIN_PASS     || 'GrowViaAdmin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'growvia-session-secret';
const dataFile   = path.join(__dirname, 'data.json');
const uploadsDir = path.join(__dirname, 'uploads');
const backupsDir = path.join(__dirname, 'backups');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

/* ── AUTO-BACKUP: daily, keep last 7 ── */
function runAutoBackup() {
  try {
    if (!fs.existsSync(dataFile)) return;
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const target = path.join(backupsDir, 'growvia-' + stamp + '.json');
    if (fs.existsSync(target)) return; // today already done
    fs.copyFileSync(dataFile, target);
    console.log('[auto-backup] saved', path.basename(target));
    const files = fs.readdirSync(backupsDir)
      .filter(f => /^growvia-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    while (files.length > 7) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(backupsDir, oldest)); console.log('[auto-backup] pruned', oldest); }
      catch (_) {}
    }
  } catch (e) { console.error('[auto-backup] failed:', e.message); }
}
// Run on startup, then check every hour
runAutoBackup();
setInterval(runAutoBackup, 60 * 60 * 1000);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 4 * 1024 * 1024 } });

/* ── RATE LIMITER: per-IP, sliding 1-hour window, max 5 orders ── */
const ORDER_LIMIT = 5;
const ORDER_WINDOW_MS = 60 * 60 * 1000;
const orderHits = new Map();
function rateLimitOrder(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const hits = (orderHits.get(ip) || []).filter(t => now - t < ORDER_WINDOW_MS);
  if (hits.length >= ORDER_LIMIT) {
    return res.status(429).json({ error: 'Too many orders from your network. Please try again in an hour.' });
  }
  hits.push(now);
  orderHits.set(ip, hits);
  // Light periodic cleanup
  if (orderHits.size > 5000) {
    for (const [k, v] of orderHits) {
      if (!v.length || now - v[v.length - 1] > ORDER_WINDOW_MS) orderHits.delete(k);
    }
  }
  next();
}

/* ── PHONE NORMALIZATION (Pakistani: +92XXXXXXXXXX) ── */
function normalizePkPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('0092') === 0) digits = digits.slice(4);
  else if (digits.indexOf('92') === 0) digits = digits.slice(2);
  else if (digits.charAt(0) === '0') digits = digits.slice(1);
  return '+92' + digits;
}

/* ── ORDER ID GENERATOR ── */
function generateGrvId() {
  const now    = new Date();
  const dd     = String(now.getDate()).padStart(2, '0');
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const yy     = String(now.getFullYear()).slice(-2);
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return 'GRV-' + dd + mm + yy + '-' + suffix;
}

/* ── PRICING HELPERS ── */
const DEFAULT_USD_TO_PKR = 280;

function defaultPricing() {
  const raw = {
    Instagram:     { Followers: 4.00, Likes: 1.50, Views: 0.80, Comments: 8.00, Shares: 3.00, Saves: 2.00, Reach: 1.00 },
    Facebook:      { Followers: 4.40, Likes: 1.65, Views: 0.88, Comments: 8.80, Shares: 3.30, Reach: 1.10 },
    TikTok:        { Followers: 3.60, Likes: 1.35, Views: 0.72, Comments: 7.20, Shares: 2.70, Saves: 1.80 },
    YouTube:       { Subscribers: 9.60, Views: 1.28, Likes: 2.40, Comments: 12.80, 'Watch Hours': 19.20, Shares: 4.80 },
    'X (Twitter)': { Followers: 4.80, Likes: 1.80, Views: 0.96, Reposts: 3.60, Comments: 9.60 },
    LinkedIn:      { Followers: 9.00, Connections: 7.20, Likes: 2.70, Comments: 14.40, Shares: 5.40 }
  };
  const out = {};
  for (const [plat, svcs] of Object.entries(raw)) {
    out[plat] = {};
    for (const [svc, usd] of Object.entries(svcs)) {
      const organic = Math.round(usd * DEFAULT_USD_TO_PKR);
      out[plat][svc] = { organic, bot: Math.round(organic * 0.5) };
    }
  }
  return out;
}

function migratePricing(pricing) {
  const out = {};
  for (const [plat, svcs] of Object.entries(pricing)) {
    out[plat] = {};
    for (const [svc, val] of Object.entries(svcs)) {
      if (typeof val === 'number') {
        const organic = Math.round(val * DEFAULT_USD_TO_PKR);
        out[plat][svc] = { organic, bot: Math.round(organic * 0.5) };
      } else if (val && typeof val === 'object') {
        // already has organic/bot OR old pkr/usd format
        if (val.organic !== undefined || val.bot !== undefined) {
          out[plat][svc] = { organic: val.organic || 0, bot: val.bot || 0 };
        } else {
          // old pkr format — migrate
          const organic = val.pkr || 0;
          out[plat][svc] = { organic, bot: Math.round(organic * 0.5) };
        }
      } else {
        out[plat][svc] = { organic: 0, bot: 0 };
      }
    }
  }
  return out;
}

/* ── DATA LAYER ── */
function parseBool(v) { return v === true || v === 'true' || v === 'on' || v === '1'; }

function normalizeHeroStats(raw) {
  const defaults = [
    { number: '12M+',  label: 'Engagements delivered', visible: true },
    { number: '40k+',  label: 'Orders completed',      visible: true },
    { number: '4.9/5', label: 'Average rating',        visible: true }
  ];
  if (!Array.isArray(raw)) return defaults;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const s = raw[i] || {};
    out.push({
      number:  String(s.number  || defaults[i].number).trim(),
      label:   String(s.label   || defaults[i].label).trim(),
      visible: s.visible === undefined ? defaults[i].visible : parseBool(s.visible)
    });
  }
  return out;
}

function normalizeChatbot(raw) {
  const d = {
    enabled: true,
    welcomeMessage: 'Hi! I am the GrowVia assistant. Ask me anything in English, Urdu or Roman Urdu — about pricing, services, delivery, payment, anything.',
    customQA: []
  };
  raw = raw || {};
  let qa = Array.isArray(raw.customQA) ? raw.customQA : [];
  qa = qa.map(function(x){
    return {
      keywords: String((x && x.keywords) || '').trim(),
      answer:   String((x && x.answer)   || '').trim()
    };
  }).filter(function(x){ return x.keywords && x.answer; });
  return {
    enabled:        raw.enabled === undefined ? d.enabled : parseBool(raw.enabled),
    welcomeMessage: String(raw.welcomeMessage || d.welcomeMessage).trim(),
    customQA:       qa
  };
}

function normalizeHelp(raw) {
  const d = {
    enabled:        true,
    title:          'Order Guide & Support',
    intro:          'A short guide to help you place a clean, accurate order — and how to reach us if anything goes wrong.',
    fillTitle:      'How to place a correct order',
    fillBody:       'Choose your platform and the service you need, enter a real, working profile or post link, and the exact quantity you want. Make sure the link is public so our team can fulfil the order. Double-check your WhatsApp number — that is how we confirm the order and send updates.',
    problemTitle:   'Facing an issue?',
    problemBody:    'If you face any problem placing an order, with payment, or with delivery, contact us directly on WhatsApp. Our team will respond in real time and resolve the matter the same day.',
    marketingTitle: 'Looking for proper marketing?',
    marketingBody:  'If you want a long-term, structured marketing campaign for your brand or business, do not place a casual order — reach out to us directly on WhatsApp. We will share a custom plan tailored to your goals, audience and budget.'
  };
  raw = raw || {};
  return {
    enabled:        raw.enabled === undefined ? d.enabled : parseBool(raw.enabled),
    title:          String(raw.title          || d.title).trim(),
    intro:          String(raw.intro          || d.intro).trim(),
    fillTitle:      String(raw.fillTitle      || d.fillTitle).trim(),
    fillBody:       String(raw.fillBody       || d.fillBody).trim(),
    problemTitle:   String(raw.problemTitle   || d.problemTitle).trim(),
    problemBody:    String(raw.problemBody    || d.problemBody).trim(),
    marketingTitle: String(raw.marketingTitle || d.marketingTitle).trim(),
    marketingBody:  String(raw.marketingBody  || d.marketingBody).trim()
  };
}

function normalizeConfig(cfg) {
  return {
    allowSingleOrder: parseBool(cfg.allowSingleOrder !== undefined ? cfg.allowSingleOrder : true),
    allowBulkOrder:   parseBool(cfg.allowBulkOrder   !== undefined ? cfg.allowBulkOrder   : true),
    offerActive:      parseBool(cfg.offerActive),
    offerText:        String(cfg.offerText        || '').trim(),
    brandName:        String(cfg.brandName        || 'GrowVia').trim(),
    brandTagline:     String(cfg.brandTagline     || 'Your Growth. Our Mission.').trim(),
    logoImageUrl:     String(cfg.logoImageUrl     || '').trim(),
    offerStart:       String(cfg.offerStart       || '').trim(),
    offerEnd:         String(cfg.offerEnd         || '').trim(),
    themeColor:       String(cfg.themeColor       || 'blue').trim(),
    allowPromoCode:   parseBool(cfg.allowPromoCode !== undefined ? cfg.allowPromoCode : false),
    offerPromoCode:   String(cfg.offerPromoCode   || '').trim().toUpperCase(),
    heroStats:        normalizeHeroStats(cfg.heroStats),
    help:             normalizeHelp(cfg.help),
    chatbot:          normalizeChatbot(cfg.chatbot),
    whatsappNumber:   (function(raw){
      let d = String(raw || '').replace(/\D/g, '');
      if (!d) return '923143632195';
      if (d.indexOf('0092') === 0) d = d.slice(4);
      else if (d.indexOf('92') === 0) d = d.slice(2);
      else if (d.charAt(0) === '0') d = d.slice(1);
      return '92' + d;
    })(cfg.whatsappNumber)
  };
}

function loadData() {
  const def = {
    config:       normalizeConfig({}),
    testimonials: [],
    faqs:         [],
    admins:       [],
    orders:       [],
    pricing:      defaultPricing(),
    accounts:     { jazzcash: { number:'', name:'' }, easypaisa: { number:'', name:'' }, sadapay: { number:'', name:'' }, nayapay: { number:'', name:'' }, bank: { bankName:'', accountTitle:'', accountNumber:'', iban:'' }, other: '' },
    platformLogos: {},
    activityLog:   [],
    promos:        []
  };
  try {
    if (!fs.existsSync(dataFile)) return def;
    const raw  = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    raw.config       = normalizeConfig(raw.config || {});
    raw.testimonials = Array.isArray(raw.testimonials) ? raw.testimonials : [];
    raw.faqs         = Array.isArray(raw.faqs)         ? raw.faqs         : [];
    raw.admins       = Array.isArray(raw.admins)       ? raw.admins       : [];
    raw.orders       = Array.isArray(raw.orders)       ? raw.orders       : [];
    raw.pricing      = raw.pricing || defaultPricing();
    raw.platformLogos = raw.platformLogos || {};
    raw.activityLog  = Array.isArray(raw.activityLog)  ? raw.activityLog  : [];
    raw.promos       = Array.isArray(raw.promos)       ? raw.promos       : [];
    return raw;
  } catch (e) { console.error('data.json read error', e); return def; }
}

function logActivity(username, role, action) {
  try {
    const d = loadData();
    d.activityLog.unshift({
      id: 'a' + Date.now() + Math.round(Math.random() * 1000),
      username: String(username || 'unknown'),
      role:     String(role     || 'Unknown'),
      action:   String(action   || ''),
      at:       new Date().toISOString()
    });
    // Cap at 500 entries to keep data.json lean
    if (d.activityLog.length > 500) d.activityLog.length = 500;
    saveData(d);
  } catch (e) { console.error('activity log error', e); }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

/* ── AUTH ── */
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  if (req.method === 'GET' || req.method === 'HEAD') return res.redirect('/login');
  return res.status(401).json({ error: 'Authentication required' });
}

function getSessionRole(req) {
  if (!req.session || !req.session.admin) return null;
  const username = req.session.username || ADMIN_USER;
  if (username === ADMIN_USER) return 'Administrator';
  
  const d = loadData();
  const admin = d.admins.find(a => a.username === username);
  return admin ? (admin.role || 'Employee') : 'Employee';
}

function requireAdmin(req, res, next) {
  const role = getSessionRole(req);
  if (role === 'Administrator' || role === 'Admin' || role === 'Master Admin') {
    return next();
  }
  return res.status(403).json({ error: 'Permission denied: Administrator role required.' });
}

function requireManagerOrAdmin(req, res, next) {
  const role = getSessionRole(req);
  if (role === 'Administrator' || role === 'Admin' || role === 'Master Admin' || role === 'Manager') {
    return next();
  }
  return res.status(403).json({ error: 'Permission denied: Manager or Administrator role required.' });
}

/* ── MIDDLEWARE ── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 }
}));
app.use('/uploads', express.static(uploadsDir));
app.use(function (req, res, next) {
  const blocked = ['/server.js','/package.json','/package-lock.json','/data.json','/admin.html'];
  if (blocked.includes(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(__dirname));

/* ═══════════════════════════════════════════
   API ROUTES
═══════════════════════════════════════════ */

/* ── CONFIG ── */
app.get('/api/config', (req, res) => {
  const d = loadData(); res.json(d.config || {});
});
app.post('/api/config', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const role = getSessionRole(req);
  if (role === 'Manager') {
    // Manager can only update offer + order-availability fields; brand/theme/WA stay locked
    const cur = d.config || {};
    const merged = Object.assign({}, cur, {
      allowSingleOrder: req.body.allowSingleOrder !== undefined ? req.body.allowSingleOrder : cur.allowSingleOrder,
      allowBulkOrder:   req.body.allowBulkOrder   !== undefined ? req.body.allowBulkOrder   : cur.allowBulkOrder,
      allowPromoCode:   req.body.allowPromoCode   !== undefined ? req.body.allowPromoCode   : cur.allowPromoCode,
      offerActive:      req.body.offerActive      !== undefined ? req.body.offerActive      : cur.offerActive,
      offerText:        req.body.offerText        !== undefined ? req.body.offerText        : cur.offerText,
      offerStart:       req.body.offerStart       !== undefined ? req.body.offerStart       : cur.offerStart,
      offerEnd:         req.body.offerEnd         !== undefined ? req.body.offerEnd         : cur.offerEnd,
      offerPromoCode:   req.body.offerPromoCode   !== undefined ? req.body.offerPromoCode   : cur.offerPromoCode
    });
    d.config = normalizeConfig(merged);
  } else {
    d.config = normalizeConfig(req.body);
  }
  saveData(d); res.json(d.config);
});
app.post('/api/config/logo', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const d = loadData();
  d.config.logoImageUrl = '/uploads/' + req.file.filename;
  saveData(d); res.json({ url: d.config.logoImageUrl });
});

/* ── USER ── */
app.get('/api/user', requireAuth, (req, res) => {
  res.json({ username: req.session.username || ADMIN_USER, role: getSessionRole(req) });
});

/* ── TESTIMONIALS ── */
app.get('/api/testimonials', (req, res) => {
  const d = loadData(); res.json(d.testimonials || []);
});
app.post('/api/testimonials', requireAuth, requireManagerOrAdmin, upload.single('image'), (req, res) => {
  const d    = loadData();
  const name = String(req.body.name || '').trim();
  const text = String(req.body.text || '').trim();
  if (!name || !text) return res.status(400).json({ error: 'Name and text required.' });
  const image = req.file
    ? '/uploads/' + req.file.filename
    : (String(req.body.imageUrl || '').trim() || 'https://i.pravatar.cc/120?img=11');
  const item = {
    id: 't' + Date.now() + Math.round(Math.random() * 1000),
    name, role: String(req.body.role || 'Customer').trim(), text, image, hidden: false
  };
  d.testimonials.unshift(item); saveData(d); res.json(item);
});
app.put('/api/testimonials/:id/toggle', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData(); let found = false;
  d.testimonials.forEach(i => { if (i.id === req.params.id) { i.hidden = !i.hidden; found = true; } });
  if (!found) return res.status(404).json({ error: 'Not found' });
  saveData(d); res.json({ success: true });
});
app.delete('/api/testimonials/:id', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  d.testimonials = d.testimonials.filter(i => i.id !== req.params.id);
  saveData(d); res.json({ success: true });
});

/* ── FAQS ── */
app.get('/api/faqs', (req, res) => {
  const d = loadData(); res.json(d.faqs || []);
});
app.post('/api/faqs', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const q = String(req.body.question || '').trim();
  const a = String(req.body.answer   || '').trim();
  if (!q || !a) return res.status(400).json({ error: 'Question and answer required.' });
  const item = { id: 'f' + Date.now() + Math.round(Math.random() * 1000), question: q, answer: a, hidden: false };
  d.faqs.unshift(item); saveData(d); res.json(item);
});
app.put('/api/faqs/:id/toggle', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData(); let found = false;
  d.faqs.forEach(i => { if (i.id === req.params.id) { i.hidden = !i.hidden; found = true; } });
  if (!found) return res.status(404).json({ error: 'Not found' });
  saveData(d); res.json({ success: true });
});
app.delete('/api/faqs/:id', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  d.faqs = d.faqs.filter(i => i.id !== req.params.id);
  saveData(d); res.json({ success: true });
});

/* ── ORDERS ── */
app.get('/api/orders', requireAuth, (req, res) => {
  const d = loadData(); res.json(d.orders || []);
});
app.post('/api/orders', rateLimitOrder, (req, res) => {
  const d    = loadData();
  const body = req.body;
  // Honeypot: bots fill any visible-looking field; humans never see it
  if (body.website || body._hp) return res.status(400).json({ error: 'Request rejected.' });
  const name     = String(body.name     || '').trim();
  const whatsapp = normalizePkPhone(body.whatsapp);
  if (!name || !whatsapp || whatsapp === '+92') return res.status(400).json({ error: 'Name and phone number are required.' });

  // Promo handling — important: look up promo INSIDE d so mutation persists on save
  const rawSubtotal = Math.max(0, Number(String(body.subtotalAmount || '').replace(/[^\d]/g, '')) || 0);
  let promoLine = '';
  let promoCode = '';
  let promoDiscount = 0;
  const promo = findActivePromo(body.promoCode, d);
  if (promo && rawSubtotal > 0) {
    const orderMode = String(body.mode || 'single').trim().toLowerCase();
    const appliesTo = normalizeAppliesTo(promo.appliesTo);
    if (appliesTo === 'both' || appliesTo === orderMode) {
      promoDiscount = computePromoDiscount(promo, rawSubtotal);
      promoCode = promo.code;
      promoLine = promo.type === 'percent'
        ? promo.code + ' (' + promo.value + '% off)'
        : promo.code + ' (₨' + promo.value.toLocaleString() + ' off)';
      promo.uses = (promo.uses || 0) + 1; // ← persists now via shared d
    }
  }

  const subtotalStr = rawSubtotal ? '₨' + rawSubtotal.toLocaleString() : '';
  const discountStr = promoDiscount ? '₨' + promoDiscount.toLocaleString() : '';
  const finalTotal = promoDiscount > 0 && rawSubtotal > 0
    ? '₨' + Math.max(0, rawSubtotal - promoDiscount).toLocaleString()
    : String(body.totalPrice || '—').trim();

  const order = {
    id: (body.id && /^GRV-\d{6}-\d{4}$/.test(String(body.id))) ? String(body.id).trim() : generateGrvId(),
    createdAt:  new Date().toISOString(),
    name, whatsapp,
    mode:        String(body.mode       || 'single').trim(),
    quality:     String(body.quality    || 'organic').trim(),
    platform:    String(body.platform   || '').trim(),
    service:     String(body.service    || '').trim(),
    qty:         String(body.qty        || '').trim(),
    link:        String(body.link       || '').trim(),
    notes:       String(body.notes      || '').trim(),
    bulkItems:   Array.isArray(body.bulkItems) ? body.bulkItems : [],
    bulkText:    String(body.bulkText   || '').trim(),
    subtotal:    rawSubtotal ? '₨' + rawSubtotal.toLocaleString() : '',
    promoCode,
    promoLabel:  promoLine,
    promoDiscount: promoDiscount ? '₨' + promoDiscount.toLocaleString() : '',
    totalPrice:  finalTotal,
    status:      'pending'
  };
  d.orders.unshift(order); saveData(d);
  res.json({ success: true, orderId: order.id, discount: promoDiscount, finalTotal });
});
/* Public order-tracking lookup (no auth) — masks PII */
app.get('/api/orders/:id/track', (req, res) => {
  const d = loadData();
  const id = String(req.params.id || '').trim();
  const o = (d.orders || []).find(x => x.id === id);
  if (!o) return res.status(404).json({ error: 'No order found with that ID.' });
  // Mask phone: +92 31x xxx xx95 (show first 3 + last 2 digits only)
  const wa = String(o.whatsapp || '');
  let maskedPhone = wa;
  const digits = wa.replace(/\D/g, '');
  if (digits.length >= 7) {
    maskedPhone = '+' + digits.slice(0, 4) + ' ' + digits.slice(4, 6) + 'x xxx xx' + digits.slice(-2);
  }
  // First name only
  const firstName = (o.name || '').split(/\s+/)[0] || '';
  // Item count for bulk
  let itemCount = 1;
  if (o.mode === 'bulk') {
    itemCount = (o.bulkText || '').split('\n').filter(l => l.trim()).length;
  }
  res.json({
    id: o.id,
    createdAt: o.createdAt,
    status: o.status,
    mode: o.mode,
    quality: o.quality === 'bot' ? 'Basic' : 'Premium',
    platform: o.platform || '',
    service: o.service || '',
    qty: o.qty || '',
    itemCount,
    totalPrice: o.totalPrice,
    customer: { name: firstName, phone: maskedPhone }
  });
});

app.put('/api/orders/:id/status', requireAuth, (req, res) => {
  const d      = loadData();
  const status = String(req.body.status || '').trim();
  const valid  = ['pending','processing','completed','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  let found = false;
  d.orders.forEach(o => { if (o.id === req.params.id) { o.status = status; found = true; } });
  if (!found) return res.status(404).json({ error: 'Order not found.' });
  saveData(d); res.json({ success: true });
});
app.delete('/api/orders/:id', requireAuth, (req, res) => {
  const d = loadData();
  d.orders = d.orders.filter(o => o.id !== req.params.id);
  saveData(d); res.json({ success: true });
});

/* ── PRICING ── */
app.get('/api/pricing', (req, res) => {
  const d = loadData();
  res.json(migratePricing(d.pricing || defaultPricing()));
});
app.post('/api/pricing', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const existing = migratePricing(d.pricing || defaultPricing());
  Object.assign(existing, req.body);
  d.pricing = existing;
  saveData(d); res.json({ success: true });
});

app.get('/api/platform-logos', (req, res) => {
  const d = loadData();
  res.json(d.platformLogos || {});
});

app.post('/api/platform-logos', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  d.platformLogos = d.platformLogos || {};
  Object.assign(d.platformLogos, req.body);
  saveData(d);
  res.json({ success: true });
});

app.delete('/api/pricing/:platform', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const p = migratePricing(d.pricing || defaultPricing());
  const platform = decodeURIComponent(req.params.platform);
  delete p[platform];
  d.pricing = p;
  if (d.platformLogos && d.platformLogos[platform.toLowerCase()]) {
    delete d.platformLogos[platform.toLowerCase()];
  }
  saveData(d); res.json({ success: true });
});
app.delete('/api/pricing/:platform/:service', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const p = migratePricing(d.pricing || defaultPricing());
  const plat = decodeURIComponent(req.params.platform);
  if (p[plat]) delete p[plat][decodeURIComponent(req.params.service)];
  d.pricing = p; saveData(d); res.json({ success: true });
});

/* ── ADMINS ── */
const MANAGER_ALLOWED_ROLES = ['Manager', 'Employee'];

app.get('/api/admins', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const list = d.admins && d.admins.length > 0
    ? d.admins
    : [{ username: ADMIN_USER, password: ADMIN_PASS, role: 'Master Admin' }];
  res.json(list.map(a => ({ username: a.username, password: a.password || '', role: a.role || 'Admin' })));
});
app.post('/api/admins', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d        = loadData();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const role     = String(req.body.role     || 'Employee').trim();
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  if (d.admins.find(a => a.username === username)) return res.status(400).json({ error: 'User already exists.' });
  if (getSessionRole(req) === 'Manager' && !MANAGER_ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Managers can only add Manager or Employee accounts.' });
  }
  d.admins.push({ username, password, role });
  saveData(d); res.json({ success: true });
});
app.put('/api/admins/:username', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const admin = d.admins.find(a => a.username === req.params.username);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  const sessionRole = getSessionRole(req);
  if (sessionRole === 'Manager') {
    if (!MANAGER_ALLOWED_ROLES.includes(admin.role)) {
      return res.status(403).json({ error: 'Managers cannot edit Admin accounts.' });
    }
    if (req.body.role && !MANAGER_ALLOWED_ROLES.includes(String(req.body.role).trim())) {
      return res.status(403).json({ error: 'Managers can only assign Manager or Employee role.' });
    }
  }
  if (req.body.password && String(req.body.password).trim()) admin.password = String(req.body.password).trim();
  if (req.body.role) admin.role = String(req.body.role).trim();
  saveData(d); res.json({ success: true });
});
app.delete('/api/admins/:username', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  if (req.params.username === req.session.username)
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  const target = d.admins.find(a => a.username === req.params.username);
  if (getSessionRole(req) === 'Manager' && target && !MANAGER_ALLOWED_ROLES.includes(target.role)) {
    return res.status(403).json({ error: 'Managers cannot delete Admin accounts.' });
  }
  d.admins = d.admins.filter(a => a.username !== req.params.username);
  saveData(d); res.json({ success: true });
});

/* ── ACCOUNTS ── */
app.get('/api/payment-methods', (req, res) => {
  const d = loadData();
  const ac = d.accounts || {};
  const methods = [];
  if (ac.jazzcash  && ac.jazzcash.number)  methods.push({ type:'jazzcash',  label:'JazzCash',  icon:'📱' });
  if (ac.easypaisa && ac.easypaisa.number) methods.push({ type:'easypaisa', label:'EasyPaisa', icon:'💚' });
  if (ac.sadapay   && ac.sadapay.number)   methods.push({ type:'sadapay',   label:'SadaPay',   icon:'⚫' });
  if (ac.nayapay   && ac.nayapay.number)   methods.push({ type:'nayapay',   label:'NayaPay',   icon:'🍊' });
  if (ac.bank      && ac.bank.accountNumber) methods.push({ type:'bank',    label:'Bank Transfer', icon:'🏦' });
  res.json(methods);
});

app.get('/api/accounts', requireAuth, (req, res) => {
  const d = loadData(); res.json(d.accounts || {});
});
app.post('/api/accounts', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  d.accounts = req.body;
  saveData(d); res.json({ success: true });
});

/* ── BACKUP ── */
app.get('/api/backup', requireAuth, (req, res) => {
  const d    = loadData();
  const name = 'growvia-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  res.setHeader('Content-Disposition', 'attachment; filename=' + name);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(d, null, 2));
});

/* ═══════════════════════════════════════════
   PAGE ROUTES
═══════════════════════════════════════════ */
app.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const d        = loadData();
  const list     = d.admins && d.admins.length > 0 ? d.admins : [{ username: ADMIN_USER, password: ADMIN_PASS }];
  const valid    = list.find(a => a.username === username && a.password === password);
  if (valid) {
    req.session.admin    = true;
    req.session.username = username;
    const role = username === ADMIN_USER ? 'Administrator' : (valid.role || 'Employee');
    logActivity(username, role, 'login');
    return res.redirect('/admin');
  }
  return res.redirect('/login?error=1');
});
app.get('/logout', (req, res) => {
  const username = req.session && req.session.username;
  if (username) {
    const role = username === ADMIN_USER ? 'Administrator' : (function(){
      const d = loadData();
      const a = d.admins.find(a => a.username === username);
      return a ? (a.role || 'Employee') : 'Unknown';
    })();
    logActivity(username, role, 'logout');
  }
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.redirect('/login'); });
});

/* ── PROMO CODES ── */
// Lookup an active promo. Pass a data object to mutate-and-save the same instance.
function findActivePromo(code, data) {
  const d = data || loadData();
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  const p = (d.promos || []).find(x => (x.code || '').toUpperCase() === c);
  if (!p || p.disabled) return null;
  if (p.expiry) {
    const exp = new Date(p.expiry).getTime();
    if (!isNaN(exp) && exp < Date.now()) return null;
  }
  if (p.maxUses && (p.uses || 0) >= p.maxUses) return null;
  return p;
}
function computePromoDiscount(promo, subtotal) {
  if (!promo || !subtotal) return 0;
  if (promo.type === 'percent') return Math.round(subtotal * (Number(promo.value) || 0) / 100);
  return Math.min(subtotal, Math.round(Number(promo.value) || 0));
}

app.get('/api/promos', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData(); res.json(d.promos || []);
});
function normalizeAppliesTo(raw) {
  const v = String(raw || 'both').trim().toLowerCase();
  return (v === 'single' || v === 'bulk') ? v : 'both';
}

app.post('/api/promos', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const code = String(req.body.code || '').trim().toUpperCase();
  const type = req.body.type === 'percent' ? 'percent' : 'flat';
  const value = Math.max(0, Number(req.body.value) || 0);
  if (!code || !value) return res.status(400).json({ error: 'Code and value required.' });
  if (type === 'percent' && value > 100) return res.status(400).json({ error: 'Percent must be 0–100.' });
  if (d.promos.find(p => (p.code || '').toUpperCase() === code)) {
    return res.status(400).json({ error: 'Code already exists.' });
  }
  const item = {
    id: 'p' + Date.now() + Math.round(Math.random() * 1000),
    code, type, value,
    expiry:    String(req.body.expiry || '').trim(),
    maxUses:   Math.max(0, Number(req.body.maxUses) || 0),
    uses:      0,
    appliesTo: normalizeAppliesTo(req.body.appliesTo),
    isPrivate: parseBool(req.body.isPrivate),
    disabled:  false,
    createdAt: new Date().toISOString()
  };
  d.promos.unshift(item); saveData(d); res.json(item);
});
app.put('/api/promos/:id/toggle', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  const p = (d.promos || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.disabled = !p.disabled; saveData(d); res.json({ success: true, disabled: p.disabled });
});
app.delete('/api/promos/:id', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  d.promos = (d.promos || []).filter(x => x.id !== req.params.id);
  saveData(d); res.json({ success: true });
});
// Public validation endpoint — returns usage info too
// Pass ?mode=single|bulk to also enforce appliesTo
app.get('/api/promos/validate/:code', (req, res) => {
  const p = findActivePromo(req.params.code);
  if (!p) return res.status(404).json({ valid: false, error: 'Invalid or expired code.' });
  const appliesTo = normalizeAppliesTo(p.appliesTo);
  const mode = String(req.query.mode || '').trim().toLowerCase();
  if (mode && appliesTo !== 'both' && mode !== appliesTo) {
    return res.status(403).json({
      valid: false,
      error: 'This code is only valid for ' + appliesTo + ' orders.'
    });
  }
  const maxUses = Number(p.maxUses) || 0;
  const uses = Number(p.uses) || 0;
  res.json({
    valid: true,
    code: p.code,
    type: p.type,
    value: p.value,
    maxUses,
    uses,
    usesLeft: maxUses ? Math.max(0, maxUses - uses) : null,
    expiry: p.expiry || '',
    appliesTo
  });
});

/* ── ACTIVITY LOG (Manager + Admin only) ── */
app.get('/api/activity-log', requireAuth, requireManagerOrAdmin, (req, res) => {
  const d = loadData();
  res.json(d.activityLog || []);
});
app.delete('/api/activity-log', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  d.activityLog = [];
  saveData(d);
  res.json({ success: true });
});
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'GrowVia.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, 'track.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log('GrowVia server running → http://localhost:' + PORT));
