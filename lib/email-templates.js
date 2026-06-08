function brandName(cfg) {
  return cfg.brand || "Pathway Prep Exams";
}

function otpEmail({ code, brand }) {
  const subject = `${brand} — your sign-in code`;
  const text = `Your Pathway Prep exam sign-in code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1e40af;margin:0 0 16px">${brand}</h2>
      <p style="color:#334155;line-height:1.6">Your sign-in code:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#0b1220">${code}</p>
      <p style="color:#64748b;font-size:14px">Expires in 10 minutes.</p>
    </div>`;
  return { subject, text, html };
}

function examCertificateEmail({ studentName, examTitle, scorePercent, brand }) {
  const subject = `${brand} — exam certificate: ${examTitle}`;
  const text = `Congratulations ${studentName}!\n\nYou passed "${examTitle}" with a score of ${scorePercent}%.\n\nYour certificate is attached.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1e40af">${brand}</h2>
      <p>Dear ${studentName},</p>
      <p>Congratulations! You passed <strong>${examTitle}</strong> with a score of <strong>${scorePercent}%</strong>.</p>
      <p>Your certificate of completion is attached to this email.</p>
    </div>`;
  return { subject, text, html };
}

function examFailEmail({ studentName, examTitle, scorePercent, cutoffPercent, brand }) {
  const subject = `${brand} — exam result: ${examTitle}`;
  const text =
    `Dear ${studentName},\n\n` +
    `Thank you for completing "${examTitle}".\n\n` +
    `Your score: ${scorePercent}%\n` +
    `Required to pass: ${cutoffPercent}%\n\n` +
    `You did not meet the pass mark for a certificate on this attempt. ` +
    `Please speak with your training partner if you need support or next steps.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1e40af">${brand}</h2>
      <p>Dear ${studentName},</p>
      <p>Thank you for completing <strong>${examTitle}</strong>.</p>
      <p style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px">
        <strong>Your score:</strong> ${scorePercent}%<br/>
        <strong>Required to pass:</strong> ${cutoffPercent}%
      </p>
      <p>You did not meet the pass mark for a certificate on this attempt. Please speak with your training partner if you need support or next steps.</p>
    </div>`;
  return { subject, text, html };
}

module.exports = { otpEmail, examCertificateEmail, examFailEmail };
