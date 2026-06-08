const XLSX = require("xlsx");
const {
  normalizeQuestionType,
  defaultOptionsForType,
  resolveCorrectIndex
} = require("./question-types");

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function collectOptions(map) {
  const options = [];
  for (let i = 1; i <= 10; i++) {
    const byNum = map[`option${i}`] ?? map[`opt${i}`];
    if (byNum != null && String(byNum).trim()) options.push(String(byNum).trim());
  }
  for (const letter of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const key = `option${letter}`;
    if (map[key] != null && String(map[key]).trim()) {
      const val = String(map[key]).trim();
      if (!options.includes(val)) options.push(val);
    }
  }
  return options;
}

const MAX_IMPORT_ROWS = 500;

function parseExcelBuffer(buffer) {
  if (!buffer || buffer.length > 1_500_000) {
    return { questions: [], errors: ["File too large (max ~1.5 MB)."] };
  }
  const wb = XLSX.read(buffer, { type: "buffer", dense: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      questions: [],
      errors: [`Too many rows (max ${MAX_IMPORT_ROWS}). Split the file and import in batches.`]
    };
  }
  const questions = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const keys = Object.keys(row);
    const map = {};
    for (const k of keys) map[normalizeHeader(k)] = row[k];

    const prompt = String(map.question || map.prompt || map.questions || "").trim();
    if (!prompt) {
      if (Object.values(row).some((v) => String(v).trim())) {
        errors.push(`Row ${idx + 2}: missing question text`);
      }
      return;
    }

    const question_type = normalizeQuestionType(map.type || map.questiontype || map.format || "");
    let options = collectOptions(map);
    const correctRaw = map.correct ?? map.answer ?? map.answers ?? map.key ?? "";

    if (question_type === "true_false" && options.length < 2) {
      options = defaultOptionsForType("true_false");
    } else if (question_type === "yes_no" && options.length < 2) {
      options = defaultOptionsForType("yes_no");
    }

    if (options.length < 2) {
      errors.push(`Row ${idx + 2}: need at least 2 options (Option1, Option2, … or OptionA–D)`);
      return;
    }

    const correct_index = resolveCorrectIndex(correctRaw, options);
    if (correct_index < 0) {
      errors.push(
        `Row ${idx + 2}: could not match Answer "${correctRaw}" — use A/B/C, 1/2/3, or exact option text`
      );
      return;
    }

    const order = parseInt(map.order || map.sortorder || map.no || idx + 1, 10);
    questions.push({
      sort_order: Number.isFinite(order) ? order : idx + 1,
      prompt,
      question_type,
      options,
      correct_index
    });
  });

  return { questions, errors };
}

module.exports = { parseExcelBuffer };
