/**
 * Dry-run certificate PDF + optional live email test.
 * Usage:
 *   node scripts/test-certificate-email.js
 *   node scripts/test-certificate-email.js --send you@example.com
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { generateExamCertificatePdf } = require("../lib/exam-certificate");
const { sendExamCertificateEmail, getEmailConfig } = require("../lib/email");

async function main() {
  const sendTo = process.argv.includes("--send") ? process.argv[process.argv.indexOf("--send") + 1] : null;
  const cfg = getEmailConfig();
  console.log("Email config:", {
    configured: cfg.configured,
    from: cfg.fromDisplay,
    domain: cfg.domain
  });

  const { buffer, filename } = await generateExamCertificatePdf({
    studentName: "Test Candidate",
    examTitle: "Healthcare Assistant — Final Assessment",
    courseName: "HEALTHCARE ASSISTANT"
  });
  console.log("PDF OK:", filename, buffer.length, "bytes");

  if (!sendTo) {
    console.log("Add --send your@email.com to send a live test.");
    return;
  }

  await sendExamCertificateEmail({
    to: sendTo,
    studentName: "Test Candidate",
    examTitle: "Healthcare Assistant — Final Assessment",
    scorePercent: 80,
    cutoffPercent: 70,
    pdfBuffer: buffer,
    pdfFilename: filename
  });
  console.log("Sent test certificate to", sendTo);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
