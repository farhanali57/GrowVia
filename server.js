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

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 4 * 1024 * 1024 } });

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
    whatsappNumber:   String(cfg.whatsappNumber   || '3143632195').trim()
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
    platformLogos: {}
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
    return raw;
  } catch (e) { console.error('data.json read error', e); return def; }
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
app.post('/api/config', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  d.config = normalizeConfig(req.body);
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
app.post('/api/testimonials', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
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
app.put('/api/testimonials/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const d = loadData(); let found = false;
  d.testimonials.forEach(i => { if (i.id === req.params.id) { i.hidden = !i.hidden; found = true; } });
  if (!found) return res.status(404).json({ error: 'Not found' });
  saveData(d); res.json({ success: true });
});
app.delete('/api/testimonials/:id', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  d.testimonials = d.testimonials.filter(i => i.id !== req.params.id);
  saveData(d); res.json({ success: true });
});

/* ── FAQS ── */
app.get('/api/faqs', (req, res) => {
  const d = loadData(); res.json(d.faqs || []);
});
app.post('/api/faqs', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  const q = String(req.body.question || '').trim();
  const a = String(req.body.answer   || '').trim();
  if (!q || !a) return res.status(400).json({ error: 'Question and answer required.' });
  const item = { id: 'f' + Date.now() + Math.round(Math.random() * 1000), question: q, answer: a, hidden: false };
  d.faqs.unshift(item); saveData(d); res.json(item);
});
app.put('/api/faqs/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const d = loadData(); let found = false;
  d.faqs.forEach(i => { if (i.id === req.params.id) { i.hidden = !i.hidden; found = true; } });
  if (!found) return res.status(404).json({ error: 'Not found' });
  saveData(d); res.json({ success: true });
});
app.delete('/api/faqs/:id', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  d.faqs = d.faqs.filter(i => i.id !== req.params.id);
  saveData(d); res.json({ success: true });
});

/* ── ORDERS ── */
app.get('/api/orders', requireAuth, (req, res) => {
  const d = loadData(); res.json(d.orders || []);
});
app.post('/api/orders', (req, res) => {
  const d    = loadData();
  const body = req.body;
  const name     = String(body.name     || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  if (!name || !whatsapp) return res.status(400).json({ error: 'Name and WhatsApp are required.' });
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
    totalPrice:  String(body.totalPrice || '—').trim(),
    status:      'pending'
  };
  d.orders.unshift(order); saveData(d);
  res.json({ success: true, orderId: order.id });
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
app.get('/api/admins', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  const list = d.admins && d.admins.length > 0
    ? d.admins
    : [{ username: ADMIN_USER, password: ADMIN_PASS, role: 'Master Admin' }];
  res.json(list.map(a => ({ username: a.username, password: a.password || '', role: a.role || 'Admin' })));
});
app.post('/api/admins', requireAuth, requireAdmin, (req, res) => {
  const d        = loadData();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const role     = String(req.body.role     || 'Employee').trim();
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  if (d.admins.find(a => a.username === username)) return res.status(400).json({ error: 'User already exists.' });
  d.admins.push({ username, password, role });
  saveData(d); res.json({ success: true });
});
app.put('/api/admins/:username', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  const admin = d.admins.find(a => a.username === req.params.username);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  if (req.body.password && String(req.body.password).trim()) admin.password = String(req.body.password).trim();
  if (req.body.role) admin.role = String(req.body.role).trim();
  saveData(d); res.json({ success: true });
});
app.delete('/api/admins/:username', requireAuth, requireAdmin, (req, res) => {
  const d = loadData();
  if (req.params.username === req.session.username)
    return res.status(400).json({ error: 'Cannot delete your own account.' });
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
app.post('/api/accounts', requireAuth, requireAdmin, (req, res) => {
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
    return res.redirect('/admin');
  }
  return res.redirect('/login?error=1');
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.redirect('/login'); });
});
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'GrowVia.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log('GrowVia server running → http://localhost:' + PORT));
