const { escapeHtml, escapeAttr } = require("./email-utils");

const BRAND_BLUE = "#3b82f6";
const BRAND_BLUE_DARK = "#2563eb";
const BRAND_BLUE_ACCENT = "#60a5fa";

function logoBlockHtml(logoUrl) {
  return logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="" width="40" height="40" style="display:inline-block;vertical-align:middle;width:40px;height:40px;border-radius:10px;object-fit:contain;background:rgba(10,15,24,.25)" />`
    : "";
}

function layoutBlue({ brand, bodyHtml, footerHtml, logoUrl }) {
  const logoBlock = logoBlockHtml(logoUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#070d18;font-family:'Segoe UI',system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#070d18;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#131f35;border:1px solid #243352;border-radius:16px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,${BRAND_BLUE},${BRAND_BLUE_DARK});padding:20px 28px">
          ${logoBlock}
          <span style="color:#ffffff;font-size:18px;font-weight:800;margin-left:${logoUrl ? "10px" : "0"};vertical-align:middle">${escapeHtml(brand)}</span>
        </td></tr>
        <tr><td style="padding:28px;color:#eef4fc;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
        <tr><td style="padding:0 28px 24px;color:#8ba3c7;font-size:12px;line-height:1.5">${footerHtml}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(rows) {
  const items = rows.filter((row) => row.value !== undefined && row.value !== null && row.value !== "");
  if (!items.length) return "";
  const cells = items
    .map(
      (row, i) => `
      <tr><td style="padding:12px 18px;color:#8ba3c7;font-size:12px;text-transform:uppercase${i ? ";border-top:1px solid #243352" : ""}">${escapeHtml(row.label)}</td></tr>
      <tr><td style="padding:0 18px 14px;color:${row.mono ? BRAND_BLUE_ACCENT : "#eef4fc"};${row.mono ? "font-family:ui-monospace,monospace;font-size:13px;font-weight:600" : "font-weight:600"}">${escapeHtml(String(row.value))}</td></tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1729;border-radius:12px;border:1px solid #243352;margin-bottom:20px">${cells}</table>`;
}

function visitButton(homeUrl) {
  const home = String(homeUrl || "https://pathwayprep.online").replace(/\/$/, "");
  return `<p style="margin:0">
      <a href="${escapeAttr(home)}" style="display:inline-block;padding:12px 24px;background:${BRAND_BLUE};color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">Visit Pathway Prep</a>
    </p>`;
}

function supportFooter(supportEmail) {
  return supportEmail
    ? `Questions: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_BLUE}">${escapeHtml(supportEmail)}</a>`
    : "";
}

function otpEmail({ code, brand }) {
  const subject = `${brand} — your sign-in code`;
  const text = `Your Pathway Prep exam sign-in code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, ignore this email.`;
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;color:#eef4fc">Your sign-in code</h1>
    <p style="margin:0 0 16px;color:#8ba3c7">Use this code to access your exam:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#eef4fc;margin:0 0 16px">${escapeHtml(code)}</p>
    <p style="margin:0;color:#8ba3c7;font-size:14px">Expires in 10 minutes.</p>`;
  const html = layoutBlue({ brand, bodyHtml, footerHtml: "", logoUrl: null });
  return { subject, text, html };
}

function examCertificateEmail({
  studentName,
  examTitle,
  courseName,
  scorePercent,
  cutoffPercent,
  batch,
  agentName,
  certificateId,
  brand,
  supportEmail,
  homeUrl,
  logoUrl
}) {
  const course = courseName || examTitle;
  const subject = `${brand} — Your course certificate (${course})`;
  const table = detailsTable([
    batch ? { label: "Batch month", value: batch } : null,
    agentName ? { label: "Agent", value: agentName } : null,
    { label: "Your score", value: `${scorePercent}%` },
    { label: "Required to pass", value: `${cutoffPercent}%` },
    certificateId ? { label: "Certificate ID", value: certificateId, mono: true } : null
  ].filter(Boolean));

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;color:#eef4fc">Your certificate is ready</h1>
    <p style="margin:0 0 16px;color:#8ba3c7">Dear <strong style="color:#eef4fc">${escapeHtml(studentName)}</strong>,</p>
    <p style="margin:0 0 16px;color:#8ba3c7">Congratulations on completing <strong style="color:${BRAND_BLUE_ACCENT}">${escapeHtml(course)}</strong>. Your official Pathway Prep certificate is attached to this email as a PDF.</p>
    ${table}
    <p style="margin:0 0 16px;color:#8ba3c7;font-size:14px">Keep this PDF for your records. If the attachment is missing, check spam or contact support with your certificate ID above.</p>
    ${visitButton(homeUrl)}`;

  const text = [
    `${brand} — Your certificate`,
    "",
    `Dear ${studentName},`,
    "",
    `Congratulations on completing ${course}.`,
    batch ? `Batch month: ${batch}` : "",
    agentName ? `Agent: ${agentName}` : "",
    `Your score: ${scorePercent}%`,
    `Required to pass: ${cutoffPercent}%`,
    certificateId ? `Certificate ID: ${certificateId}` : "",
    "",
    "Your certificate PDF is attached to this email.",
    supportEmail ? `Support: ${supportEmail}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html: layoutBlue({ brand, bodyHtml, footerHtml: supportFooter(supportEmail), logoUrl }),
    text
  };
}

function examFailEmail({
  studentName,
  examTitle,
  courseName,
  scorePercent,
  cutoffPercent,
  batch,
  agentName,
  brand,
  supportEmail,
  homeUrl,
  logoUrl,
  submitReason
}) {
  const course = courseName || examTitle;
  const subject = `${brand} — Your exam result (${course})`;
  const timedOut = submitReason === "timeout";
  const table = detailsTable([
    batch ? { label: "Batch month", value: batch } : null,
    agentName ? { label: "Agent", value: agentName } : null,
    { label: "Your score", value: `${scorePercent}%` },
    { label: "Required to pass", value: `${cutoffPercent}%` },
    timedOut ? { label: "Submit reason", value: "Time expired (auto-submitted)" } : null
  ].filter(Boolean));

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;color:#eef4fc">Your exam result</h1>
    <p style="margin:0 0 16px;color:#8ba3c7">Dear <strong style="color:#eef4fc">${escapeHtml(studentName)}</strong>,</p>
    <p style="margin:0 0 16px;color:#8ba3c7">Thank you for completing <strong style="color:${BRAND_BLUE_ACCENT}">${escapeHtml(course)}</strong>. You did not meet the pass mark on this attempt.${
      timedOut
        ? " Your answers were saved automatically when the timer reached zero."
        : ""
    }</p>
    ${table}
    <p style="margin:0 0 16px;color:#8ba3c7;font-size:14px">To sit the exam again, please re-register through your Agent. If you have questions about your next steps, contact support below.</p>
    ${visitButton(homeUrl)}`;

  const text = [
    `${brand} — Your exam result`,
    "",
    `Dear ${studentName},`,
    "",
    `Thank you for completing ${course}.`,
    `Your score: ${scorePercent}%`,
    `Required to pass: ${cutoffPercent}%`,
    batch ? `Batch month: ${batch}` : "",
    agentName ? `Agent: ${agentName}` : "",
    "",
    "You did not meet the pass mark on this attempt. To sit the exam again, please re-register through your Agent.",
    supportEmail ? `Support: ${supportEmail}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html: layoutBlue({ brand, bodyHtml, footerHtml: supportFooter(supportEmail), logoUrl }),
    text
  };
}

function examIntegrityEmail({
  studentName,
  examTitle,
  courseName,
  scorePercent,
  cutoffPercent,
  batch,
  agentName,
  brand,
  supportEmail,
  homeUrl,
  logoUrl,
  passed
}) {
  const course = courseName || examTitle;
  const subject = `${brand} — Exam integrity notice (${course})`;
  const table = detailsTable([
    batch ? { label: "Batch month", value: batch } : null,
    agentName ? { label: "Agent", value: agentName } : null,
    { label: "Submit reason", value: "Left exam window (auto-submitted)" },
    { label: "Score recorded", value: `${scorePercent}%` },
    { label: "Required to pass", value: `${cutoffPercent}%` },
    { label: "Outcome", value: passed ? "Pass mark reached — under review" : "Did not pass" }
  ].filter(Boolean));

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;color:#eef4fc">Exam auto-submitted — integrity notice</h1>
    <p style="margin:0 0 16px;color:#8ba3c7">Dear <strong style="color:#eef4fc">${escapeHtml(studentName)}</strong>,</p>
    <p style="margin:0 0 16px;color:#8ba3c7">Your <strong style="color:${BRAND_BLUE_ACCENT}">${escapeHtml(course)}</strong> attempt was <strong style="color:#eef4fc">automatically submitted</strong> because you left the exam window or switched to another app or tab more than once during the timed session.</p>
    ${table}
    <p style="margin:0 0 16px;color:#8ba3c7;font-size:14px">This is recorded as an integrity event. Your result has been saved, but <strong style="color:#eef4fc">no certificate will be issued</strong> for this attempt. If you need to sit the exam again, please contact your Agent to discuss re-registration.</p>
    <p style="margin:0 0 16px;color:#8ba3c7;font-size:14px">Sharing exam questions with AI tools or other people is prohibited and may lead to disqualification.</p>
    ${visitButton(homeUrl)}`;

  const text = [
    `${brand} — Exam integrity notice`,
    "",
    `Dear ${studentName},`,
    "",
    `Your ${course} exam was auto-submitted because you left the exam window multiple times.`,
    `Score recorded: ${scorePercent}% (pass mark ${cutoffPercent}%)`,
    passed ? "Outcome: Pass mark reached — under integrity review" : "Outcome: Did not pass",
    "",
    "No certificate will be issued for this attempt. Contact your Agent to discuss next steps.",
    supportEmail ? `Support: ${supportEmail}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html: layoutBlue({ brand, bodyHtml, footerHtml: supportFooter(supportEmail), logoUrl }),
    text
  };
}

module.exports = { otpEmail, examCertificateEmail, examFailEmail, examIntegrityEmail };
