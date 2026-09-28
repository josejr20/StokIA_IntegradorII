const config = require('../config');

const buckets = new Map();

const authRateLimit = (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= config.AUTH_RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= config.AUTH_RATE_LIMIT_MAX) {
    const retryAfterMs = Math.max(0, config.AUTH_RATE_LIMIT_WINDOW_MS - (now - current.startedAt));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
      retryAfterMs,
    });
  }
  current.count += 1;
  return next();
};

module.exports = { authRateLimit };