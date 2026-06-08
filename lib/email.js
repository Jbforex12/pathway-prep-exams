const { Resend } = require("resend");
const { getEmailConfig, assertEmailReady } = require("./email-config");
const { otpEmail, examCertificateEmail, examFailEmail } = require("./email-templates");
const { isProductionDeploy } = require("./security");

let resendClient = null;

function getResend() {
  const cfg = getEmailConfig();
  if (!cfg.apiKeySet) return null;
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY.trim().replace(/^["']|["']$/g, "");
    resendClient = new Resend(key);
  }
  return resendClient;
}

function formatResendError(msg) {
  const lower = String(msg).toLowerCase();
  if (lower.includes("only send testing emails") || lower.includes("your own email")) {
    return (
      "Resend test mode: verify pathwayprep.online in Resend and set RESEND_FROM to " +
      "portal@pathwayprep.online (same as the partners portal)."
    );
  }
  if (lower.includes("domain") || lower.includes("verify")) {
    return "Email domain not verified in Resend. Set RESEND_FROM and RESEND_DOMAIN on the exam Render service.";
  }
  if (lower.includes("attachment") || lower.includes("too large")) {
    return `Email attachment rejected by Resend: ${msg}`;
  }
  return msg;
}

async function sendMail({ to, subject, html, text, attachments }) {
  const cfg = assertEmailReady();
  const client = getResend();
  const payload = {
    from: cfg.fromDisplay,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text
  };
  if (cfg.replyTo) payload.reply_to = cfg.replyTo;
  if (attachments?.length) {
    payload.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : String(a.content || ""),
      content_type: a.contentType || a.content_type || undefined
    }));
  }

  if (!client) {
    console.log("\n📧 Email (dev — RESEND_API_KEY not set):\n", text, "\n");
    if (attachments?.length) {
      console.log(`  Attachments: ${attachments.map((a) => a.filename).join(", ")}`);
    }
    if (isProductionDeploy()) {
      throw new Error("RESEND_API_KEY is not set on the exam server.");
    }
    return { ok: true, dev: true };
  }

  const { data, error } = await client.emails.send(payload);
  if (error) {
    const msg = error.message || JSON.stringify(error);
    console.error("Resend error:", msg);
    throw new Error(formatResendError(msg));
  }
  console.log(`Email sent to ${to} (id: ${data?.id || "unknown"})`);
  return { ok: true, id: data?.id };
}

async function sendOtpEmail(to, code) {
  const cfg = getEmailConfig();
  const tpl = otpEmail({ code, brand: cfg.brand });
  return sendMail({ to, ...tpl });
}

function examMailExtras(cfg) {
  const homeUrl = (process.env.PORTAL_HOME_URL || "https://pathwayprep.online").replace(/\/$/, "");
  const logoUrl = (process.env.EMAIL_LOGO_URL || `${homeUrl}/logo.png`).trim() || null;
  return { homeUrl, logoUrl, supportEmail: cfg.supportEmail };
}

async function sendExamCertificateEmail({
  to,
  studentName,
  examTitle,
  courseName,
  scorePercent,
  cutoffPercent,
  batch,
  agentName,
  certificateId,
  pdfBuffer,
  pdfFilename
}) {
  const cfg = getEmailConfig();
  const tpl = examCertificateEmail({
    studentName,
    examTitle,
    courseName,
    scorePercent,
    cutoffPercent,
    batch,
    agentName,
    certificateId,
    brand: cfg.brand,
    ...examMailExtras(cfg)
  });
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
    throw new Error("Certificate PDF was not generated.");
  }
  return sendMail({
    to,
    ...tpl,
    attachments: [
      {
        filename: pdfFilename || "Pathway-Prep-Certificate.pdf",
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });
}

async function sendExamFailEmail({
  to,
  studentName,
  examTitle,
  courseName,
  scorePercent,
  cutoffPercent,
  batch,
  agentName
}) {
  const cfg = getEmailConfig();
  const tpl = examFailEmail({
    studentName,
    examTitle,
    courseName,
    scorePercent,
    cutoffPercent,
    batch,
    agentName,
    brand: cfg.brand,
    ...examMailExtras(cfg)
  });
  return sendMail({ to, ...tpl });
}

module.exports = { sendOtpEmail, sendExamCertificateEmail, sendExamFailEmail, getEmailConfig };
