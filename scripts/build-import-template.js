const XLSX = require("xlsx");
const path = require("path");

const rows = [
  {
    Order: 1,
    Type: "multiple_choice",
    Question: "What is the primary role of a healthcare assistant?",
    Option1: "Diagnose patients",
    Option2: "Support patient care under supervision",
    Option3: "Prescribe medication",
    Option4: "Perform surgery",
    Answer: "B"
  },
  {
    Order: 2,
    Type: "true_false",
    Question: "Hand hygiene should be performed before and after patient contact.",
    Option1: "True",
    Option2: "False",
    Answer: "True"
  },
  {
    Order: 3,
    Type: "yes_no",
    Question: "Should you report safeguarding concerns to your supervisor?",
    Option1: "Yes",
    Option2: "No",
    Answer: "Yes"
  },
  {
    Order: 4,
    Type: "multiple_choice",
    Question: "Which document records care given to a patient?",
    Option1: "Shopping list",
    Option2: "Care plan or care notes",
    Option3: "Staff rota only",
    Answer: "2"
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Questions");
const out = path.join(__dirname, "..", "assets", "question-import-template.xlsx");
XLSX.writeFile(wb, out);
console.log("Wrote", out);
