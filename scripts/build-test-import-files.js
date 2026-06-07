const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const XLSX = require("xlsx");

const QUESTIONS = [
  {
    order: 1,
    prompt: "What is the primary role of a healthcare assistant?",
    options: [
      "Diagnose patients independently",
      "Support patient care under supervision",
      "Prescribe medication",
      "Perform surgery"
    ],
    correct: "B"
  },
  {
    order: 2,
    prompt: "Which action best supports infection control in a care setting?",
    options: [
      "Reuse gloves between patients",
      "Skip hand hygiene when busy",
      "Follow hand hygiene and PPE protocols",
      "Store used PPE in communal areas"
    ],
    correct: "C"
  },
  {
    order: 3,
    prompt: "A patient refuses help with personal care. What should you do first?",
    options: [
      "Force assistance for their safety",
      "Ignore the refusal and continue",
      "Respect their choice and report concerns to a senior",
      "Leave the patient alone for the rest of the shift"
    ],
    correct: "C"
  },
  {
    order: 4,
    prompt: "Which document is essential for recording care given to a patient?",
    options: [
      "Shopping list",
      "Care plan or care notes",
      "Staff rota only",
      "Social media post"
    ],
    correct: "B"
  },
  {
    order: 5,
    prompt: "What does person-centred care mean?",
    options: [
      "Doing tasks as quickly as possible",
      "Treating all patients exactly the same",
      "Putting the patient's preferences and dignity at the centre",
      "Making decisions without consulting the patient"
    ],
    correct: "C"
  },
  {
    order: 6,
    prompt: "You notice a colleague being rough with a resident. What is your duty?",
    options: [
      "Say nothing to avoid conflict",
      "Report it through the proper safeguarding procedure",
      "Confront them publicly on the ward",
      "Post about it online"
    ],
    correct: "B"
  },
  {
    order: 7,
    prompt: "Which vital sign is measured with a sphygmomanometer?",
    options: ["Temperature", "Blood pressure", "Respiratory rate", "Oxygen saturation"],
    correct: "B"
  },
  {
    order: 8,
    prompt: "When moving a patient, what should you always consider?",
    options: [
      "Only your own comfort",
      "Manual handling and risk assessment",
      "Speed above safety",
      "Whether anyone is watching"
    ],
    correct: "B"
  },
  {
    order: 9,
    prompt: "A patient with dementia is agitated. A helpful first response is to:",
    options: [
      "Shout to get their attention",
      "Restrain them immediately",
      "Stay calm, reassure, and remove triggers if safe",
      "Leave them in a noisy corridor"
    ],
    correct: "C"
  },
  {
    order: 10,
    prompt: "Confidential patient information should be:",
    options: [
      "Shared with anyone who asks",
      "Discussed in public areas",
      "Kept secure and shared only on a need-to-know basis",
      "Posted on staff group chats"
    ],
    correct: "C"
  }
];

const assetsDir = path.join(__dirname, "..", "assets");

function buildExcel() {
  const rows = QUESTIONS.map((q) => ({
    Order: q.order,
    Question: q.prompt,
    OptionA: q.options[0],
    OptionB: q.options[1],
    OptionC: q.options[2],
    OptionD: q.options[3],
    Correct: q.correct
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  const out = path.join(assetsDir, "test-exam-questions.xlsx");
  XLSX.writeFile(wb, out);
  return out;
}

function buildTextTemplate() {
  const letters = ["A", "B", "C", "D"];
  const lines = [
    "Pathway Prep - Test Exam Questions (Healthcare Assistant)",
    "Use this file to make a PDF in Word/Google Docs if needed.",
    ""
  ];
  for (const q of QUESTIONS) {
    lines.push(`${q.order}. ${q.prompt}`);
    q.options.forEach((opt, i) => lines.push(`${letters[i]}) ${opt}`));
    lines.push(`Answer: ${q.correct}`);
    lines.push("");
  }
  const out = path.join(assetsDir, "test-exam-questions.txt");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  return out;
}

function buildPdf() {
  const script = path.join(__dirname, "build-test-pdf.py");
  execSync(`python "${script}"`, { stdio: "inherit" });
  return path.join(assetsDir, "test-exam-questions.pdf");
}

async function main() {
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  const xlsx = buildExcel();
  const txt = buildTextTemplate();
  const pdf = buildPdf();

  const desktopCandidates = [
    path.join(process.env.USERPROFILE || "", "Desktop"),
    path.join(process.env.USERPROFILE || "", "OneDrive", "Desktop")
  ];
  const desktop = desktopCandidates.find((d) => fs.existsSync(d));
  if (desktop) {
    for (const src of [xlsx, pdf, txt]) {
      fs.copyFileSync(src, path.join(desktop, path.basename(src)));
    }
    console.log("Copied to Desktop:", desktop);
  }

  console.log("Created:");
  console.log(" ", xlsx);
  console.log(" ", pdf);
  console.log(" ", txt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
