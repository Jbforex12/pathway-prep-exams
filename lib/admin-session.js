const jwt = require("jsonwebtoken");

const COOKIE_NAME = "pp_exam_admin_session";
const SESSION_HOURS = 8;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function cookieSecure(publicUrl) {
  return String(publicUrl || "").startsWith("https://");
}

function signAdminSession(jwtSecret) {
  return jwt.sign({ role: "exam_admin" }, jwtSecret, { expiresIn: `${SESSION_HOURS}h` });
}

function verifyAdminSession(token, jwtSecret) {
  if (!token) return false;
  try {
    const payload = jwt.verify(String(token), jwtSecret);
    return payload && payload.role === "exam_admin";
  } catch {
    return false;
  }
}

function setAdminSessionCookie(res, token, publicUrl) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_HOURS * 3600}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (cookieSecure(publicUrl)) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearAdminSessionCookie(res, publicUrl) {
  const parts = [`${COOKIE_NAME}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Strict"];
  if (cookieSecure(publicUrl)) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function readAdminSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || "";
}

module.exports = {
  COOKIE_NAME,
  signAdminSession,
  verifyAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  readAdminSessionToken
};
