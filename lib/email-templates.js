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

function examResultSubject({ brand, examTitle }) {
  return `${brand} — your result: ${examTitle}`;
}

function examResultSignOff(brand) {
  return `— ${brand}`;
}

function examCertificateEmail({ studentName, examTitle, scorePercent, cutoffPercent, brand }) {
  const subject = examResultSubject({ brand, examTitle });
  const text =
    `${brand}\n\n` +
    `Dear ${studentName},\n\n` +
    `Congratulations on passing ${examTitle}.\n\n` +
    `Your score: ${scorePercent}%\n` +
    `Required to pass: ${cutoffPercent}%\n\n` +
    `You've met the pass mark. Your certificate of completion is attached to this email. ` +
    `If you have any questions about your next steps, please speak with your training partner.\n\n` +
    examResultSignOff(brand);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#334155;line-height:1.6">
      <h2 style="color:#1e40af;margin:0 0 20px">${brand}</h2>
      <p>Dear ${studentName},</p>
      <p>Congratulations on passing <strong>${examTitle}</strong>.</p>
      <p style="margin:20px 0">
        <strong>Your score:</strong> ${scorePercent}%<br/>
        <strong>Required to pass:</strong> ${cutoffPercent}%
      </p>
      <p>You've met the pass mark. Your certificate of completion is attached to this email. If you have any questions about your next steps, please speak with your training partner.</p>
      <p style="margin-top:24px;color:#64748b">${examResultSignOff(brand)}</p>
    </div>`;
  return { subject, text, html };
}

function examFailEmail({ studentName, examTitle, scorePercent, cutoffPercent, brand }) {
  const subject = examResultSubject({ brand, examTitle });
  const text =
    `${brand}\n\n` +
    `Dear ${studentName},\n\n` +
    `Thank you for completing ${examTitle}.\n\n` +
    `Your score: ${scorePercent}%\n` +
    `Required to pass: ${cutoffPercent}%\n\n` +
    `You did not meet the pass mark for a certificate on this attempt. ` +
    `To sit the exam again, please re-register through your training partner.\n\n` +
    examResultSignOff(brand);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#334155;line-height:1.6">
      <h2 style="color:#1e40af;margin:0 0 20px">${brand}</h2>
      <p>Dear ${studentName},</p>
      <p>Thank you for completing <strong>${examTitle}</strong>.</p>
      <p style="margin:20px 0">
        <strong>Your score:</strong> ${scorePercent}%<br/>
        <strong>Required to pass:</strong> ${cutoffPercent}%
      </p>
      <p>You did not meet the pass mark for a certificate on this attempt. To sit the exam again, please re-register through your training partner.</p>
      <p style="margin-top:24px;color:#64748b">${examResultSignOff(brand)}</p>
    </div>`;
  return { subject, text, html };
}

module.exports = { otpEmail, examCertificateEmail, examFailEmail };
