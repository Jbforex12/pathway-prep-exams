const QUESTION_TYPES = ["multiple_choice", "true_false", "yes_no"];

function normalizeQuestionType(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (["truefalse", "tf", "boolean"].includes(key)) return "true_false";
  if (["yesno", "yn"].includes(key)) return "yes_no";
  if (["multiplechoice", "mcq", "choice"].includes(key)) return "multiple_choice";
  if (QUESTION_TYPES.includes(String(raw || "").trim())) return String(raw).trim();
  return "multiple_choice";
}

function defaultOptionsForType(type) {
  if (type === "true_false") return ["True", "False"];
  if (type === "yes_no") return ["Yes", "No"];
  return [];
}

function letterToIndex(letter) {
  const c = String(letter || "").trim().toUpperCase();
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 65;
  const n = parseInt(c, 10);
  if (n >= 1 && n <= 26) return n - 1;
  return -1;
}

function resolveCorrectIndex(answerRaw, options) {
  const answer = String(answerRaw ?? "").trim();
  if (!answer || !options.length) return -1;

  const letterIdx = letterToIndex(answer);
  if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;

  const lower = answer.toLowerCase();
  for (let i = 0; i < options.length; i++) {
    if (String(options[i]).trim().toLowerCase() === lower) return i;
  }

  if (lower === "true" || lower === "t") {
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === "true");
    if (idx >= 0) return idx;
  }
  if (lower === "false" || lower === "f") {
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === "false");
    if (idx >= 0) return idx;
  }
  if (lower === "yes" || lower === "y") {
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === "yes");
    if (idx >= 0) return idx;
  }
  if (lower === "no" || lower === "n") {
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === "no");
    if (idx >= 0) return idx;
  }

  return -1;
}

function normalizeQuestionInput(body) {
  const prompt = String(body.prompt || "").trim();
  const question_type = normalizeQuestionType(body.question_type);
  let options = Array.isArray(body.options) ? body.options.map(String).map((s) => s.trim()).filter(Boolean) : [];

  if (question_type === "true_false") {
    options = options.length >= 2 ? options.slice(0, 2) : defaultOptionsForType("true_false");
  } else if (question_type === "yes_no") {
    options = options.length >= 2 ? options.slice(0, 2) : defaultOptionsForType("yes_no");
  }

  const correct_index = parseInt(body.correct_index, 10);
  if (!prompt || options.length < 2 || correct_index < 0 || correct_index >= options.length) {
    return null;
  }

  return { prompt, question_type, options, correct_index };
}

module.exports = {
  QUESTION_TYPES,
  normalizeQuestionType,
  defaultOptionsForType,
  letterToIndex,
  resolveCorrectIndex,
  normalizeQuestionInput
};
