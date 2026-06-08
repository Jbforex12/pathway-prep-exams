const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { FIELDS, MASKS, maskRect, px, py, ART_H, PAGE_H } = require("./certificate-layout");

const ROOT = path.join(__dirname, "..");

function templatePath() {
  const custom = String(process.env.CERTIFICATE_TEMPLATE_PATH || "").trim();
  if (custom) {
    const resolved = path.resolve(custom);
    const assetsDir = path.resolve(ROOT, "assets");
    if (resolved.startsWith(assetsDir + path.sep) && fs.existsSync(resolved)) {
      return resolved;
    }
    console.warn("CERTIFICATE_TEMPLATE_PATH ignored — must be under assets/");
  }
  return path.join(ROOT, "assets", "certificate-template.pdf");
}

function pdfSafeText(str) {
  return String(str || "")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function ensureTemplateFile() {
  let tpl = templatePath();
  if (fs.existsSync(tpl)) return tpl;
  const buildScript = path.join(ROOT, "scripts", "build-certificate-template.js");
  if (!fs.existsSync(buildScript)) {
    throw new Error("Certificate template missing and build script not found.");
  }
  console.log("Certificate template missing — building from certificate-design.html...");
  execSync(`node "${buildScript}"`, { cwd: ROOT, stdio: "inherit" });
  tpl = templatePath();
  if (!fs.existsSync(tpl)) {
    throw new Error("Certificate template build failed. Run: npm run cert:build-template");
  }
  return tpl;
}

const INK = rgb(0.07, 0.07, 0.1);
/** Matches director signature rule on template artwork */
const LINE_BLUE = rgb(24 / 255, 0 / 255, 172 / 255);
const PAPER = rgb(1, 1, 1);

function sanitizeFilename(name) {
  return String(name || "certificate")
    .replace(/[^\p{L}\p{M}0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "certificate";
}

function fitFontSize(text, font, maxWidth, baseSize, minSize = 11) {
  let size = baseSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function wrapLine(text, font, size, maxWidth) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function courseLabel(courseName) {
  const course = String(courseName || "").trim() || "Pathway Prep Programme";
  if (/\bcourse\b/i.test(course)) return course;
  return `${course} course`;
}

function buildCourseParagraph(courseName, font) {
  const course = courseLabel(courseName);
  const text = `Has successfully completed the ${course} offered by Pathway Prep by JB Academy Limited.`;
  const fontSize = FIELDS.course.fontSize;
  const maxWidth = px(FIELDS.course.maxWidth);
  const lines = wrapLine(text, font, fontSize, maxWidth).slice(0, FIELDS.course.maxLines);
  const y = lines.map((_, i) => py(FIELDS.course.firstBaseline + i * FIELDS.course.lineHeight));
  return { lines, y, fontSize };
}

function pickNameFontSize(studentName, font, lineWidthPt) {
  const trimmed = studentName.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const { shortFontSize, fontSize, minFontSize } = FIELDS.name;

  let base = fontSize;
  if (words.length === 1 && trimmed.length <= 14) {
    base = shortFontSize;
  } else if (trimmed.length <= 22) {
    base = fontSize;
  }

  return fitFontSize(trimmed, font, lineWidthPt, base, minFontSize);
}

function drawNameUnderline(page, lineX, lineW, baselineY) {
  const { lineThicknessArt, lineGap } = FIELDS.name;
  const gapPt = (lineGap / ART_H) * PAGE_H;
  const lineThickness = (lineThicknessArt / ART_H) * PAGE_H;
  page.drawRectangle({
    x: lineX,
    y: baselineY - gapPt - lineThickness,
    width: lineW,
    height: lineThickness,
    color: LINE_BLUE,
    borderWidth: 0
  });
}

function namePlacement(studentName, font, size) {
  const { lineLeft, lineRight } = FIELDS.name;
  const lineX = px(lineLeft);
  const lineW = px(lineRight) - lineX;
  const nameWidth = font.widthOfTextAtSize(studentName, size);
  const nameX = lineX + (lineW - nameWidth) / 2;
  return { nameX, lineX, lineW };
}

async function generateCertificatePdf(opts) {
  const studentName = pdfSafeText(String(opts.studentName || "").trim());
  const courseName = pdfSafeText(String(opts.courseName || "").trim());
  if (!studentName) throw new Error("Student name is required for the certificate.");
  const tpl = ensureTemplateFile();

  const pdfDoc = await PDFDocument.load(fs.readFileSync(tpl));
  const page = pdfDoc.getPage(0);
  const nameFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const nameMaxWidth = px(FIELDS.name.maxWidth);
  const nameSize = pickNameFontSize(studentName, nameFont, nameMaxWidth);
  const nameBaselineY = py(FIELDS.name.nameBaseline);
  const { nameX, lineX, lineW } = namePlacement(studentName, nameFont, nameSize);

  const nameMask = MASKS.find((m) => m.id === "name-text");
  if (nameMask) {
    const wipe = maskRect(nameMask);
    page.drawRectangle({ ...wipe, color: PAPER, borderWidth: 0 });
  }

  page.drawText(studentName, {
    x: nameX,
    y: nameBaselineY,
    size: nameSize,
    font: nameFont,
    color: INK
  });

  drawNameUnderline(page, lineX, lineW, nameBaselineY);

  const courseX = px(FIELDS.course.x);
  const { lines, y, fontSize: courseFontSize } = buildCourseParagraph(courseName, bodyFont);
  lines.forEach((line, i) => {
    page.drawText(line, {
      x: courseX,
      y: y[i],
      size: courseFontSize,
      font: bodyFont,
      color: INK
    });
  });

  const bytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(bytes),
    filename: `Pathway-Prep-Certificate-${sanitizeFilename(studentName)}.pdf`
  };
}

module.exports = { generateCertificatePdf, sanitizeFilename, templatePath, ensureTemplateFile };
