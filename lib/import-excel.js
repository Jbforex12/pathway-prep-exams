const XLSX = require("xlsx");

function letterToIndex(letter) {
  const c = String(letter || "").trim().toUpperCase();
  if (c === "A") return 0;
  if (c === "B") return 1;
  if (c === "C") return 2;
  if (c === "D") return 3;
  const n = parseInt(c, 10);
  if (n >= 1 && n <= 4) return n - 1;
  return -1;
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const questions = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const keys = Object.keys(row);
    const map = {};
    for (const k of keys) map[normalizeHeader(k)] = row[k];

    const prompt = String(map.question || map.prompt || "").trim();
    const optA = String(map.optiona || map.a || "").trim();
    const optB = String(map.optionb || map.b || "").trim();
    const optC = String(map.optionc || map.c || "").trim();
    const optD = String(map.optiond || map.d || "").trim();
    const correctRaw = map.correct || map.answer || "";
    const order = parseInt(map.order || map.sortorder || idx + 1, 10);

    if (!prompt) {
      if (Object.values(row).some((v) => String(v).trim())) {
        errors.push(`Row ${idx + 2}: missing question text`);
      }
      return;
    }

    const options = [optA, optB, optC, optD].filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${idx + 2}: need at least 2 options`);
      return;
    }

    const correctIndex = letterToIndex(correctRaw);
    if (correctIndex < 0 || correctIndex >= options.length) {
      errors.push(`Row ${idx + 2}: invalid Correct value (use A, B, C, or D)`);
      return;
    }

    questions.push({
      sort_order: Number.isFinite(order) ? order : idx + 1,
      prompt,
      options,
      correct_index: correctIndex
    });
  });

  return { questions, errors };
}

module.exports = { parseExcelBuffer };
