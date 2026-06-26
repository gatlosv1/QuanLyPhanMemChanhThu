const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitStore = new Map();

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function rateLimit(options = {}) {
  const windowMs = options.windowMs || RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests || RATE_LIMIT_MAX_REQUESTS;

  return (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now - entry.firstRequestAt > windowMs) {
      rateLimitStore.set(key, { count: 1, firstRequestAt: now });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((windowMs - (now - entry.firstRequestAt)) / 1000)
      });
    }

    next();
  };
}

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[<>]/g, '');
}

function validateQRPayload(req, res, next) {
  const body = req.body || {};

  const requiredFields = ['ttxe', 'ma_lo'];
  for (const field of requiredFields) {
    if (!body[field] || String(body[field]).trim() === '') {
      return res.status(400).json({ error: `Thiếu trường bắt buộc: ${field}` });
    }
  }

  const ttxe = sanitizeString(body.ttxe);
  const maLo = sanitizeString(body.ma_lo);
  const ncc = sanitizeString(body.ncc || '');
  const noi = sanitizeString(body.noi || '');
  const hang = sanitizeString(body.hang || '');
  const mui = sanitizeString(body.mui || '');

  if (!/^[A-Za-z0-9-]{1,50}$/.test(ttxe)) {
    return res.status(400).json({ error: 'ttxe không hợp lệ' });
  }

  if (!/^[A-Za-z0-9-_.]{1,100}$/.test(maLo)) {
    return res.status(400).json({ error: 'ma_lo không hợp lệ' });
  }

  if (ncc && !/^[A-Za-z0-9-_.]{1,20}$/.test(ncc)) {
    return res.status(400).json({ error: 'ncc không hợp lệ' });
  }

  if (noi && !/^[A-Za-z0-9-_.]{1,20}$/.test(noi)) {
    return res.status(400).json({ error: 'noi không hợp lệ' });
  }

  if (hang && !/^[A-Za-z0-9-_.]{1,10}$/.test(hang)) {
    return res.status(400).json({ error: 'hang không hợp lệ' });
  }

  if (mui && !/^[A-Za-z0-9-_.]{1,10}$/.test(mui)) {
    return res.status(400).json({ error: 'mui không hợp lệ' });
  }

  req.body = {
    ...body,
    ttxe,
    ma_lo: maLo,
    ncc,
    noi,
    hang,
    mui
  };

  next();
}

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const expectedToken = process.env.API_TOKEN || 'demo-admin-token';
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const roleHeader = req.headers['x-user-role'] || req.headers['x-role'] || 'admin';
  req.user = { role: String(roleHeader).toLowerCase() };
  next();
}

function authorizeRole(allowedRoles = []) {
  return (req, res, next) => {
    const role = req.user?.role || 'guest';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  rateLimit,
  validateQRPayload,
  authenticateRequest,
  authorizeRole
};
