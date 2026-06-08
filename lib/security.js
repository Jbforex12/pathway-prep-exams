const crypto = require("crypto");

const MIN_SECRET_LEN = 32;
const MAX_INTEGRITY_EVENTS = 2;
const TIMER_GRACE_MS = 30_000;

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

function secureCompare(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function resolveOtpPepper(envFn, jwtSecret) {
  const pepper = trimEnv(envFn("OTP_PEPPER"));
  if (pepper) {
    if (isProductionDeploy()) assertStrongSecret("OTP_PEPPER", pepper);
    return pepper;
  }
  return jwtSecret;
}

function hashOtp(code, pepper) {
  const secret = String(pepper || "dev-insecure-otp-pepper");
  return crypto.createHmac("sha256", secret).update(String(code)).digest("hex");
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
  resolveOtpPepper,
  clientIp,
  secureCompare,
  hashOtp,
  generateOtp,
  newId,
  MAX_INTEGRITY_EVENTS,
  TIMER_GRACE_MS
};
