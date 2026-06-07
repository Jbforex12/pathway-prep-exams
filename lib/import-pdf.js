const pdfParse = require("pdf-parse");

function letterToIndex(letter) {
  const c = String(letter || "").trim().toUpperCase().replace(/[^A-D]/g, "");
  if (c === "A") return 0;
  if (c === "B") return 1;
  if (c === "C") return 2;
  if (c === "D") return 3;
  return -1;
}

function parsePdfText(text) {
  const blocks = String(text || "")
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  const chunkPattern =
    /(\d+)\.\s*([\s\S]*?)\nA\)\s*(.+?)\nB\)\s*(.+?)(?:\nC\)\s*(.+?))?(?:\nD\)\s*(.+?))?\nAnswer:\s*([A-D])/gi;

  let match;
  let found = false;
  while ((match = chunkPattern.exec(text)) !== null) {
    found = true;
    const order = parseInt(match[1], 10);
    const prompt = match[2].trim().replace(/\s+/g, " ");
    const opts = [match[3], match[4], match[5], match[6]].map((o) =>
      o ? String(o).trim() : ""
    ).filter(Boolean);
    const correctIndex = letterToIndex(match[7]);
    if (opts.length < 2 || correctIndex < 0 || correctIndex >= opts.length) {
      errors.push(`Question ${order}: could not parse options or answer`);
      continue;
    }
    questions.push({
      sort_order: order,
      prompt,
      options: opts,
      correct_index: correctIndex
    });
  }

  if (!found) {
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 4) continue;
      const head = lines[0].match(/^(\d+)\.\s*(.+)$/);
      if (!head) continue;
      const order = parseInt(head[1], 10);
      const prompt = head[2];
      const opts = [];
      let correctIndex = -1;
      for (let i = 1; i < lines.length; i++) {
        const opt = lines[i].match(/^([A-D])\)\s*(.+)$/i);
        if (opt) opts.push(opt[2].trim());
        const ans = lines[i].match(/^Answer:\s*([A-D])/i);
        if (ans) correctIndex = letterToIndex(ans[1]);
      }
      if (opts.length >= 2 && correctIndex >= 0 && correctIndex < opts.length) {
        questions.push({ sort_order: order, prompt, options: opts, correct_index: correctIndex });
        found = true;
      }
    }
  }

  if (!questions.length) {
    errors.push(
      "No questions found. Use the template format: numbered question, A) B) C) D) lines, then Answer: B"
    );
  }

  return { questions, errors };
}

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return parsePdfText(data.text);
}

module.exports = { parsePdfBuffer, parsePdfText };
