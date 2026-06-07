const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const BLUE = rgb(30 / 255, 64 / 255, 175 / 255);
const INK = rgb(0.07, 0.07, 0.1);

async function generateExamCertificatePdf({
  studentName,
  examTitle,
  courseName,
  scorePercent,
  completedAt,
  certificateId
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: BLUE, borderWidth: 2 });
  page.drawText("Pathway Prep", { x: 48, y: height - 72, size: 14, font: fontBold, color: BLUE });
  page.drawText("Certificate of Exam Completion", {
    x: 48,
    y: height - 110,
    size: 28,
    font: fontBold,
    color: INK
  });

  const dateStr = new Date(completedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const lines = [
    `This certifies that`,
    studentName,
    `has successfully completed the examination`,
    `"${examTitle}"`,
    `(${courseName})`,
    `with a score of ${scorePercent}%`,
    `on ${dateStr}.`,
    ``,
    `Certificate ID: ${certificateId}`
  ];

  let y = height - 180;
  for (const line of lines) {
    const isName = line === studentName;
    page.drawText(line, {
      x: 48,
      y,
      size: isName ? 22 : 14,
      font: isName ? fontBold : font,
      color: INK
    });
    y -= isName ? 36 : 24;
  }

  page.drawText("Pathway Prep by JB Academy Limited", {
    x: 48,
    y: 56,
    size: 11,
    font,
    color: BLUE
  });

  return Buffer.from(await pdf.save());
}

module.exports = { generateExamCertificatePdf };
