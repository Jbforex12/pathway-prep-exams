const XLSX = require("xlsx");
const path = require("path");

const rows = [
  {
    Order: 1,
    Question: "What is the primary role of a healthcare assistant?",
    OptionA: "Diagnose patients",
    OptionB: "Support patient care under supervision",
    OptionC: "Prescribe medication",
    OptionD: "Perform surgery",
    Correct: "B"
  },
  {
    Order: 2,
    Question: "Which action best supports infection control?",
    OptionA: "Reuse gloves between patients",
    OptionB: "Skip hand hygiene when busy",
    OptionC: "Follow hand hygiene and PPE protocols",
    OptionD: "Store PPE in patient rooms only",
    Correct: "C"
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Questions");
const out = path.join(__dirname, "..", "assets", "question-import-template.xlsx");
XLSX.writeFile(wb, out);
console.log("Wrote", out);
