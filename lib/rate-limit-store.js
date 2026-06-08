const { clientIp } = require("./security");

const memoryBuckets = new Map();

function memoryRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (memoryBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  memoryBuckets.set(key, hits);
  return true;
}

async function dbRateLimit(key, limit, windowMs) {
  const { getDb } = require("../db");
  const db = getDb();
  const now = Date.now();
  const row = await db.get("SELECT count, window_start FROM rate_limits WHERE key = ?", [key]);
  if (!row || now - Number(row.window_start) >= windowMs) {
    await db.run(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      [key, now]
    );
    return true;
  }
  if (Number(row.count) >= limit) return false;
  await db.run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", [key]);
  return true;
}

async function checkRateLimit(key, limit, windowMs) {
  try {
    return await dbRateLimit(key, limit, windowMs);
  } catch (e) {
    console.warn("Rate limit DB fallback:", e.message);
    return memoryRateLimit(key, limit, windowMs);
  }
}

function rateLimitMiddleware(scope, limit, windowMs) {
  return async (req, res, next) => {
    const key = `${scope}:${clientIp(req)}`;
    const ok = await checkRateLimit(key, limit, windowMs);
    if (!ok) {
      return res.status(429).json({ error: "Too many requests. Please wait and try again." });
    }
    next();
  };
}

async function getRateLimitCount(key, windowMs) {
  try {
    const { getDb } = require("../db");
    const db = getDb();
    const now = Date.now();
    const row = await db.get("SELECT count, window_start FROM rate_limits WHERE key = ?", [key]);
    if (!row || now - Number(row.window_start) >= windowMs) return 0;
    return Number(row.count) || 0;
  } catch {
    const now = Date.now();
    const hits = (memoryBuckets.get(key) || []).filter((t) => now - t < windowMs);
    return hits.length;
  }
}

async function recordRateLimitHit(key, windowMs) {
  try {
    const { getDb } = require("../db");
    const db = getDb();
    const now = Date.now();
    const row = await db.get("SELECT count, window_start FROM rate_limits WHERE key = ?", [key]);
    if (!row || now - Number(row.window_start) >= windowMs) {
      await db.run(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
        [key, now]
      );
      return 1;
    }
    const next = Number(row.count) + 1;
    await db.run("UPDATE rate_limits SET count = ? WHERE key = ?", [next, key]);
    return next;
  } catch {
    memoryRateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
    return await getRateLimitCount(key, windowMs);
  }
}

function rateLimitByValue(scope, value, limit, windowMs) {
  const key = `${scope}:${String(value || "").trim().toLowerCase()}`;
  return checkRateLimit(key, limit, windowMs);
}

module.exports = {
  checkRateLimit,
  rateLimitMiddleware,
  rateLimitByValue,
  getRateLimitCount,
  recordRateLimitHit
};
