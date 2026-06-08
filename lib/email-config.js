const { isProductionDeploy } = require("./security");

function env(name) {
  let v = (process.env[name] || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function parseFromAddress(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  if (s.includes("@")) return { name: "", email: s.toLowerCase() };
  return { name: "", email: "" };
}

function emailDomain(addr) {
  const at = addr.lastIndexOf("@");
  return at > 0 ? addr.slice(at + 1) : "";
}

function getEmailConfig() {
  const apiKey = env("RESEND_API_KEY");
  const fromRaw = env("RESEND_FROM");
  const replyTo = env("RESEND_REPLY_TO") || "";
  const domain = (env("RESEND_DOMAIN") || emailDomain(parseFromAddress(fromRaw).email)).toLowerCase();
  const brand = env("EMAIL_BRAND_NAME") || "Pathway Prep";
  const support = env("EMAIL_SUPPORT") || replyTo || (domain ? `support@${domain}` : "");
  const from = parseFromAddress(fromRaw);
  const configured = !!apiKey && !!from.email;
  const sandboxOnly = !!from.email && from.email.endsWith("@resend.dev");

  return {
    configured,
    apiKeySet: !!apiKey,
    from: from.email ? { name: from.name || brand, email: from.email } : null,
    fromDisplay: from.email ? (from.name ? `${from.name} <${from.email}>` : from.email) : null,
    replyTo: replyTo || null,
    domain,
    brand,
    supportEmail: support,
    sandboxOnly,
    sandboxNote: sandboxOnly
      ? "Test sender: emails only deliver to your Resend account address until you verify a custom domain."
      : null
  };
}

function assertEmailReady() {
  const cfg = getEmailConfig();
  if (!cfg.apiKeySet) {
    if (isProductionDeploy()) {
      throw new Error("RESEND_API_KEY is not set on the exam server.");
    }
    console.warn("RESEND_API_KEY not set — emails logged to console only.");
    return cfg;
  }
  if (!cfg.from?.email) {
    throw new Error("RESEND_FROM is not set (e.g. Pathway Prep <portal@pathwayprep.online>).");
  }
  if (cfg.domain && !cfg.from.email.endsWith("@" + cfg.domain) && !cfg.sandboxOnly) {
    throw new Error(
      `RESEND_FROM (${cfg.from.email}) must use your verified domain (${cfg.domain}).`
    );
  }
  return cfg;
}

module.exports = { getEmailConfig, assertEmailReady, parseFromAddress, env };
