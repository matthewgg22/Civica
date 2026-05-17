import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { StoredPackage, VerificationFlow, VerificationPackage } from "@/types/verification";

// SQLite-backed package store. Single table, JSON blob per package.
// Path is overridable for tests via SNAP_DB_PATH; defaults to .data/snap.db
// at the project root so it gets git-ignored.

declare global {
  // eslint-disable-next-line no-var
  var __SNAP_DB__: Database.Database | undefined;
}

function dbPath(): string {
  if (process.env.SNAP_DB_PATH) return process.env.SNAP_DB_PATH;
  const dir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "snap.db");
}

function getDb(): Database.Database {
  if (globalThis.__SNAP_DB__) return globalThis.__SNAP_DB__;
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      flow TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      package_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at DESC);
  `);
  globalThis.__SNAP_DB__ = db;
  return db;
}

function newId(): string {
  return "pkg_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface Row {
  id: string;
  flow: VerificationFlow;
  applicant_name: string;
  created_at: string;
  package_json: string;
}

function rowToStored(row: Row): StoredPackage {
  return {
    id: row.id,
    flow: row.flow,
    applicant_name: row.applicant_name,
    created_at: row.created_at,
    package: JSON.parse(row.package_json) as VerificationPackage,
  };
}

export function savePackage(pkg: VerificationPackage, applicant_name: string): StoredPackage {
  const stored: StoredPackage = {
    id: newId(),
    flow: pkg.flow,
    applicant_name,
    created_at: new Date().toISOString(),
    package: pkg,
  };
  getDb()
    .prepare(
      `INSERT INTO packages (id, flow, applicant_name, created_at, package_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(stored.id, stored.flow, stored.applicant_name, stored.created_at, JSON.stringify(pkg));
  return stored;
}

export function getPackage(pkgId: string): StoredPackage | undefined {
  const row = getDb().prepare(`SELECT * FROM packages WHERE id = ?`).get(pkgId) as Row | undefined;
  return row ? rowToStored(row) : undefined;
}

export function listPackages(): StoredPackage[] {
  const rows = getDb()
    .prepare(`SELECT * FROM packages ORDER BY created_at DESC`)
    .all() as Row[];
  return rows.map(rowToStored);
}

export function _resetForTests(): void {
  getDb().exec(`DELETE FROM packages;`);
}
