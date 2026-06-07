const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const EXAM_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_name TEXT NOT NULL,
      cutoff_percent INTEGER NOT NULL DEFAULT 70,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      question_count INTEGER NOT NULL DEFAULT 20,
      shuffle_mode TEXT NOT NULL DEFAULT 'questions',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      score_percent INTEGER,
      passed INTEGER,
      question_order_json TEXT NOT NULL,
      option_maps_json TEXT NOT NULL,
      answers_json TEXT,
      certificate_sent_at TEXT,
      certificate_id TEXT,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_candidate ON exam_attempts(candidate_id);
    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );
`;

let dbInstance = null;
let dbMode = "local";

function env(name) {
  let v = (process.env[name] || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function normalizeRow(row) {
  if (row == null) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

function normalizeRows(rows) {
  return (rows || []).map((r) => normalizeRow(r));
}

class ExamDatabase {
  constructor(mode, backend) {
    this.mode = mode;
    if (mode === "local") this.local = backend;
    else this.client = backend;
    this._tx = null;
  }

  _executor() {
    if (this.mode === "local") return this.local;
    return this._tx || this.client;
  }

  async get(sql, args = []) {
    if (this.mode === "local") {
      return normalizeRow(this.local.prepare(sql).get(...args));
    }
    const r = await this._executor().execute({ sql, args });
    if (!r.rows.length) return undefined;
    return normalizeRow(r.rows[0]);
  }

  async all(sql, args = []) {
    if (this.mode === "local") {
      return normalizeRows(this.local.prepare(sql).all(...args));
    }
    const r = await this._executor().execute({ sql, args });
    return normalizeRows(r.rows);
  }

  async run(sql, args = []) {
    if (this.mode === "local") {
      const info = this.local.prepare(sql).run(...args);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
    const r = await this._executor().execute({ sql, args });
    return { changes: r.rowsAffected ?? 0, lastInsertRowid: r.lastInsertRowid };
  }

  async exec(sql) {
    if (this.mode === "local") {
      this.local.exec(sql);
      return;
    }
    await this._executor().executeMultiple(sql);
  }
}

async function initDb(dataDir) {
  const tursoUrl = env("TURSO_DATABASE_URL");
  const tursoToken = env("TURSO_AUTH_TOKEN");

  if (tursoUrl && tursoToken) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    dbInstance = new ExamDatabase("turso", client);
    dbMode = "turso";
    await dbInstance.exec(EXAM_SCHEMA_SQL);
    console.log("Exam database: Turso (shared with portal candidates)");
    return dbInstance;
  }

  const dir = dataDir || path.join(__dirname, "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "pathway-exams.db");
  const local = new DatabaseSync(dbPath);
  local.exec(EXAM_SCHEMA_SQL);
  dbInstance = new ExamDatabase("local", local);
  dbMode = "local";
  console.log(`Exam database: local SQLite (${dbPath})`);
  return dbInstance;
}

function getDb() {
  if (!dbInstance) throw new Error("Database not initialized");
  return dbInstance;
}

function getDbMode() {
  return dbMode;
}

async function findCandidateByEmail(email) {
  const db = getDb();
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  return db.get(
    `SELECT c.*, co.company_name
     FROM candidates c
     JOIN companies co ON co.id = c.company_id
     WHERE lower(trim(c.email)) = ?`,
    [normalized]
  );
}

module.exports = { initDb, getDb, getDbMode, findCandidateByEmail, ExamDatabase };
