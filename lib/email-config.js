function env(name) {
  let v = (process.env[name] || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function getEmailConfig() {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RESEND_FROM") || "Pathway Prep <onboarding@resend.dev>";
  const replyTo = env("RESEND_REPLY_TO") || "";
  const brand = env("EMAIL_BRAND_NAME") || "Pathway Prep Exams";
  return {
    apiKeySet: !!apiKey,
    fromDisplay: from,
    replyTo,
    brand
  };
}

function assertEmailReady() {
  const cfg = getEmailConfig();
  if (!cfg.apiKeySet) {
    console.warn("RESEND_API_KEY not set — emails logged to console only.");
  }
  return cfg;
}

module.exports = { getEmailConfig, assertEmailReady };
