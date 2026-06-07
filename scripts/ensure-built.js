const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const out = path.join(__dirname, "..", "exam-portal-design", "out", "index.html");
if (fs.existsSync(out)) process.exit(0);
console.log("Building exam portal UI...");
execSync("npm run exam:build", { stdio: "inherit", cwd: path.join(__dirname, "..") });
