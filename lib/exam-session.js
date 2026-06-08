const jwt = require("jsonwebtoken");
const { isProductionDeploy } = require("./security");

const COOKIE_NAME = "pp_exam_session";
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
  return isProductionDeploy() || String(publicUrl || "").startsWith("https://");
}

function signStudentSession(jwtSecret, candidateId, email) {
  return jwt.sign(
    { role: "student", sub: candidateId, email: String(email || "").toLowerCase() },
    jwtSecret,
    { expiresIn: `${SESSION_HOURS}h` }
  );
}

function verifyStudentSession(token, jwtSecret) {
  if (!token) return null;
  try {
    const payload = jwt.verify(String(token), jwtSecret, { algorithms: ["HS256"] });
    if (!payload || payload.role !== "student" || !payload.sub) return null;
    return { candidateId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

function setStudentSessionCookie(res, token, publicUrl) {
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

function clearStudentSessionCookie(res, publicUrl) {
  const parts = [`${COOKIE_NAME}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Strict"];
  if (cookieSecure(publicUrl)) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function readStudentSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || "";
}

module.exports = {
  COOKIE_NAME,
  signStudentSession,
  verifyStudentSession,
  setStudentSessionCookie,
  clearStudentSessionCookie,
  readStudentSessionToken
};
