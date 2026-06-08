const { Resend } = require("resend");
const { getEmailConfig, assertEmailReady } = require("./email-config");
const { otpEmail, examCertificateEmail, examFailEmail } = require("./email-templates");

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
      content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : String(a.content || "")
    }));
  }

  if (!client) {
    console.log("\n📧 Email (dev):\n", text, "\n");
    return { ok: true, dev: true };
  }

  const { data, error } = await client.emails.send(payload);
  if (error) {
    const msg = error.message || JSON.stringify(error);
    console.error("Resend error:", msg);
    throw new Error(formatResendError(msg));
  }
  return { ok: true, id: data?.id };
}

function formatResendError(msg) {
  const lower = String(msg).toLowerCase();
  if (lower.includes("only send testing emails") || lower.includes("your own email")) {
    return (
      "Resend test mode: verify your domain and set RESEND_FROM to an address on that domain " +
      "(e.g. portal@pathwayprep.online)."
    );
  }
  if (lower.includes("domain") || lower.includes("verify")) {
    return "Email domain not verified in Resend. Check RESEND_FROM and domain DNS.";
  }
  if (lower.includes("attachment") || lower.includes("too large")) {
    return `Email attachment rejected by Resend: ${msg}`;
  }
  return msg;
}

async function sendOtpEmail(to, code) {
  const cfg = getEmailConfig();
  const tpl = otpEmail({ code, brand: cfg.brand });
  return sendMail({ to, ...tpl });
}

async function sendExamCertificateEmail({
  to,
  studentName,
  examTitle,
  scorePercent,
  cutoffPercent,
  pdfBuffer,
  pdfFilename
}) {
  const cfg = getEmailConfig();
  const tpl = examCertificateEmail({
    studentName,
    examTitle,
    scorePercent,
    cutoffPercent,
    brand: cfg.brand
  });
  return sendMail({
    to,
    ...tpl,
    attachments: [
      {
        filename: pdfFilename || "Pathway-Prep-Certificate.pdf",
        content: pdfBuffer
      }
    ]
  });
}

async function sendExamFailEmail({ to, studentName, examTitle, scorePercent, cutoffPercent }) {
  const cfg = getEmailConfig();
  const tpl = examFailEmail({ studentName, examTitle, scorePercent, cutoffPercent, brand: cfg.brand });
  return sendMail({ to, ...tpl });
}

module.exports = { sendOtpEmail, sendExamCertificateEmail, sendExamFailEmail };
