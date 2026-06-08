const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");

function ensure(command, missingLabel, checkPath) {
  if (fs.existsSync(checkPath)) return;
  console.log(missingLabel);
  execSync(command, { stdio: "inherit", cwd: root });
}

ensure(
  "npm run cert:build-template",
  "Building certificate template...",
  path.join(root, "assets", "certificate-template.pdf")
);

ensure(
  "npm run exam:build",
  "Building exam portal UI...",
  path.join(root, "exam-portal-design", "out", "index.html")
);
