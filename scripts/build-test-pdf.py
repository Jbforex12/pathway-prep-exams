"""Generate test-exam-questions.pdf in the fixed import template format."""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

QUESTIONS = [
    (
        1,
        "What is the primary role of a healthcare assistant?",
        [
            "Diagnose patients independently",
            "Support patient care under supervision",
            "Prescribe medication",
            "Perform surgery",
        ],
        "B",
    ),
    (
        2,
        "Which action best supports infection control in a care setting?",
        [
            "Reuse gloves between patients",
            "Skip hand hygiene when busy",
            "Follow hand hygiene and PPE protocols",
            "Store used PPE in communal areas",
        ],
        "C",
    ),
    (
        3,
        "A patient refuses help with personal care. What should you do first?",
        [
            "Force assistance for their safety",
            "Ignore the refusal and continue",
            "Respect their choice and report concerns to a senior",
            "Leave the patient alone for the rest of the shift",
        ],
        "C",
    ),
    (
        4,
        "Which document is essential for recording care given to a patient?",
        [
            "Shopping list",
            "Care plan or care notes",
            "Staff rota only",
            "Social media post",
        ],
        "B",
    ),
    (
        5,
        "What does person-centred care mean?",
        [
            "Doing tasks as quickly as possible",
            "Treating all patients exactly the same",
            "Putting the patient's preferences and dignity at the centre",
            "Making decisions without consulting the patient",
        ],
        "C",
    ),
    (
        6,
        "You notice a colleague being rough with a resident. What is your duty?",
        [
            "Say nothing to avoid conflict",
            "Report it through the proper safeguarding procedure",
            "Confront them publicly on the ward",
            "Post about it online",
        ],
        "B",
    ),
    (
        7,
        "Which vital sign is measured with a sphygmomanometer?",
        ["Temperature", "Blood pressure", "Respiratory rate", "Oxygen saturation"],
        "B",
    ),
    (
        8,
        "When moving a patient, what should you always consider?",
        [
            "Only your own comfort",
            "Manual handling and risk assessment",
            "Speed above safety",
            "Whether anyone is watching",
        ],
        "B",
    ),
    (
        9,
        "A patient with dementia is agitated. A helpful first response is to:",
        [
            "Shout to get their attention",
            "Restrain them immediately",
            "Stay calm, reassure, and remove triggers if safe",
            "Leave them in a noisy corridor",
        ],
        "C",
    ),
    (
        10,
        "Confidential patient information should be:",
        [
            "Shared with anyone who asks",
            "Discussed in public areas",
            "Kept secure and shared only on a need-to-know basis",
            "Posted on staff group chats",
        ],
        "C",
    ),
]

LETTERS = ["A", "B", "C", "D"]
assets = os.path.join(os.path.dirname(__file__), "..", "assets")
out = os.path.join(assets, "test-exam-questions.pdf")

c = canvas.Canvas(out, pagesize=letter)
text = c.beginText(50, 750)
text.setLeading(14)
text.textLine("Pathway Prep - Test Exam Questions (Healthcare Assistant)")
text.textLine("Import template format for admin PDF upload testing.")
text.textLine("")

for order, prompt, options, correct in QUESTIONS:
    text.textLine(f"{order}. {prompt}")
    for i, opt in enumerate(options):
        text.textLine(f"{LETTERS[i]}) {opt}")
    text.textLine(f"Answer: {correct}")
    text.textLine("")

c.drawText(text)
c.save()
print(out)
