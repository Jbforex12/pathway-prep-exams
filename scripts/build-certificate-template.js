/**
 * Build assets/certificate-template.pdf from the HTML design artwork.
 * Prefers extracting the JPEG from assets/certificate-design.html when present.
 */
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const { PAGE_W, PAGE_H, MASKS, maskRect } = require("../lib/certificate-layout");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "certificate-template.pdf");
const HTML_SOURCE = path.join(ROOT, "assets", "certificate-design.html");
const JPG_SOURCE = path.join(ROOT, "assets", "certificate-template-source.jpg");
const PNG_SOURCE = path.join(ROOT, "assets", "certificate-template-source.png");

function extractJpegFromHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)/i);
  if (!match) return null;
  return Buffer.from(match[1].replace(/\s+/g, ""), "base64");
}

function resolveArtworkBytes() {
  if (fs.existsSync(PNG_SOURCE)) {
    return { bytes: fs.readFileSync(PNG_SOURCE), label: path.basename(PNG_SOURCE) };
  }
  if (fs.existsSync(JPG_SOURCE)) {
    return { bytes: fs.readFileSync(JPG_SOURCE), label: path.basename(JPG_SOURCE) };
  }
  if (fs.existsSync(HTML_SOURCE)) {
    const fromHtml = extractJpegFromHtml(HTML_SOURCE);
    if (fromHtml?.length) {
      fs.writeFileSync(JPG_SOURCE, fromHtml);
      return { bytes: fromHtml, label: "certificate-design.html" };
    }
  }
  throw new Error(
    "Certificate artwork missing. Add certificate-template-source.png or .jpg."
  );
}

async function main() {
  const { bytes, label } = resolveArtworkBytes();
  const doc = await PDFDocument.create();
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const paper = rgb(1, 1, 1);
  for (const region of MASKS) {
    const rect = maskRect(region);
    page.drawRectangle({ ...rect, color: paper, borderWidth: 0 });
    page.drawRectangle({ ...rect, color: paper, borderWidth: 0 });
  }

  fs.writeFileSync(OUT, await doc.save());
  console.log("Wrote", OUT, "from", label);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
