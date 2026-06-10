/**
 * Wipe all exam content and candidate registrations (keeps partner companies + codes).
 * Usage: node scripts/wipe-platform.js
 * Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env (or environment).
 */
const path = require("path");
const fs = require("fs");
const root = path.join(__dirname, "..");
const envCandidates = [
  path.join(root, ".env"),
  path.join(root, "..", "pathway-prep-portal", ".env")
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    break;
  }
}
const { initDb } = require("../db");
const { wipeExamPlatform } = require("../lib/wipe-platform");

async function main() {
  await initDb(path.join(__dirname, "..", "data"));
  const result = await wipeExamPlatform();
  console.log(result.message);
  console.log("Removed:", result.removed);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
