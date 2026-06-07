const crypto = require("crypto");

const buckets = new Map();
const MIN_SECRET_LEN = 32;

function isProductionDeploy() {
  return !!(process.env.RENDER || process.env.NODE_ENV === "production");
}

function trimEnv(value) {
  let v = String(value || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function assertStrongSecret(name, value) {
  if (!value || value.length < MIN_SECRET_LEN) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LEN} characters in production.`);
  }
  if (value === "change-this-key") {
    throw new Error(`${name} cannot use the default placeholder in production.`);
  }
}

function resolveAdminKey(envFn) {
  const key = trimEnv(envFn("EXAM_ADMIN_KEY"));
  if (key && key !== "change-this-key") return key;
  if (isProductionDeploy()) assertStrongSecret("EXAM_ADMIN_KEY", key);
  return key || "change-this-key";
}

function resolveJwtSecret(envFn, adminKey) {
  const jwt = trimEnv(envFn("EXAM_JWT_SECRET"));
  if (jwt) {
    if (isProductionDeploy()) assertStrongSecret("EXAM_JWT_SECRET", jwt);
    return jwt;
  }
  if (isProductionDeploy()) {
    throw new Error("EXAM_JWT_SECRET must be set in production.");
  }
  return crypto.randomBytes(32).toString("hex");
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

function rateLimitMiddleware(scope, limit, windowMs) {
  return (req, res, next) => {
    const key = `${scope}:${clientIp(req)}`;
    if (!rateLimit(key, limit, windowMs)) {
      return res.status(429).json({ error: "Too many requests. Please wait and try again." });
    }
    next();
  };
}

function secureCompare(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

module.exports = {
  isProductionDeploy,
  trimEnv,
  resolveAdminKey,
  resolveJwtSecret,
  clientIp,
  rateLimitMiddleware,
  secureCompare,
  hashOtp,
  generateOtp,
  newId
};
