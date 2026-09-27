import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.join(process.cwd(), "mock-data");

const COLLECTIONS = [
  "sellers",
  "buyers",
  "otp_codes",
  "orders",
  "products",
  "invoices",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export function collectionFile(name: CollectionName) {
  return path.join(DATA_DIR, `${name}.json`);
}

// ---------------------------------------------------------------------------
// Storage: SQLite (node:sqlite, built-in). Rows live as JSON documents so the
// repository below keeps its exact in-memory filtering semantics. Falls back
// to /tmp when the project directory is read-only (deployed/serverless).
// ---------------------------------------------------------------------------

let sql: DatabaseSync | null = null;

function resolveDbPath(): string {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, ".write-probe");
    fs.writeFileSync(probe, "1");
    fs.unlinkSync(probe);
    return path.join(DATA_DIR, "mock.db");
  } catch {
    return path.join(os.tmpdir(), "payproof-mock.db");
  }
}

function getSql(): DatabaseSync {
  if (sql) return sql;
  const db = new DatabaseSync(resolveDbPath());
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_rows (
      collection TEXT NOT NULL,
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mock_rows_collection ON mock_rows(collection);
    CREATE TABLE IF NOT EXISTS mock_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  sql = db;
  importLegacyJsonOnce(db);
  return db;
}

function importLegacyJsonOnce(db: DatabaseSync) {
  const marker = db.prepare("SELECT value FROM mock_meta WHERE key = ?").get("json_imported");
  if (marker) return;
  for (const name of COLLECTIONS) {
    let rows: any[] = [];
    try {
      const file = collectionFile(name);
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (Array.isArray(parsed)) rows = parsed;
      }
    } catch {}
    if (rows.length > 0) {
      const ins = db.prepare("INSERT INTO mock_rows (collection, data) VALUES (?, ?)");
      for (const row of rows) ins.run(name, JSON.stringify(row));
    }
  }
  db.prepare("INSERT OR REPLACE INTO mock_meta (key, value) VALUES (?, ?)").run(
    "json_imported",
    "1",
  );
}

export function readCollection(name: CollectionName): any[] {
  try {
    const rows = getSql()
      .prepare("SELECT data FROM mock_rows WHERE collection = ? ORDER BY seq")
      .all(name);
    return rows.map((row) => JSON.parse(String(row.data)));
  } catch {
    return [];
  }
}

export function writeCollection(name: CollectionName, rows: any[]) {
  const db = getSql();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM mock_rows WHERE collection = ?").run(name);
    const ins = db.prepare("INSERT INTO mock_rows (collection, data) VALUES (?, ?)");
    for (const row of rows) ins.run(name, JSON.stringify(row));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function ensureCollectionFiles() {
  getSql();
}

export function generateId() {
  return crypto.randomUUID();
}

export function generateInvoiceCode() {
  return "INV-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

export function hashPassword(password: string) {
  return Buffer.from(password).toString("base64");
}

export function verifyPassword(password: string, hash: string) {
  return hashPassword(password) === hash;
}

export const db = {
  sellers: {
    findByEmail: (email: string) => {
      return readCollection("sellers").find((s) => s.email === email);
    },
    findById: (id: string) => {
      return readCollection("sellers").find((s) => s.id === id);
    },
    insert: (seller: any) => {
      const rows = readCollection("sellers");
      rows.push(seller);
      writeCollection("sellers", rows);
    },
    update: (id: string, patch: any) => {
      const rows = readCollection("sellers");
      const row = rows.find((s) => s.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      writeCollection("sellers", rows);
      return row;
    },
  },
  buyers: {
    findByEmail: (email: string) => {
      return readCollection("buyers").find((b) => b.email === email);
    },
    findById: (id: string) => {
      return readCollection("buyers").find((b) => b.id === id);
    },
    insert: (buyer: any) => {
      const rows = readCollection("buyers");
      rows.push(buyer);
      writeCollection("buyers", rows);
    },
  },
  orders: {
    findBySeller: (sellerId: string) => {
      return readCollection("orders").filter((o) => o.seller_id === sellerId);
    },
    insertMany: (orders: any[]) => {
      const rows = readCollection("orders");
      rows.push(...orders);
      writeCollection("orders", rows);
    },
    updateById: (orderId: string, mutator: (order: any) => void) => {
      const rows = readCollection("orders");
      const row = rows.find((o) => o.id === orderId);
      if (!row) return null;
      mutator(row);
      writeCollection("orders", rows);
      return row;
    },
  },
  products: {
    findBySeller: (sellerId: string) => {
      return readCollection("products").filter((p) => p.seller_id === sellerId);
    },
    findById: (id: string) => {
      return readCollection("products").find((p) => p.id === id);
    },
    insert: (product: any) => {
      const rows = readCollection("products");
      rows.push(product);
      writeCollection("products", rows);
    },
    insertMany: (products: any[]) => {
      const rows = readCollection("products");
      rows.push(...products);
      writeCollection("products", rows);
    },
    updateById: (productId: string, mutator: (product: any) => void) => {
      const rows = readCollection("products");
      const row = rows.find((p) => p.id === productId);
      if (!row) return null;
      mutator(row);
      writeCollection("products", rows);
      return row;
    },
    removeById: (productId: string) => {
      const rows = readCollection("products");
      const next = rows.filter((p) => p.id !== productId);
      if (next.length === rows.length) return false;
      writeCollection("products", next);
      return true;
    },
  },
  invoices: {
    findBySeller: (sellerId: string) => {
      return readCollection("invoices").filter(
        (i) => i.seller_id === sellerId,
      );
    },
    findById: (id: string) => {
      return readCollection("invoices").find((i) => i.id === id);
    },
    findByCode: (code: string) => {
      const target = code.toUpperCase();
      return readCollection("invoices").find(
        (i) => String(i.code ?? i.id).toUpperCase() === target,
      );
    },
    insert: (invoice: any) => {
      const rows = readCollection("invoices");
      rows.push(invoice);
      writeCollection("invoices", rows);
    },
    updateById: (invoiceId: string, mutator: (invoice: any) => void) => {
      const rows = readCollection("invoices");
      const row = rows.find((i) => i.id === invoiceId);
      if (!row) return null;
      mutator(row);
      writeCollection("invoices", rows);
      return row;
    },
  },
  otps: {
    findLatestByEmail: (email: string) => {
      const records = readCollection("otp_codes").filter(
        (o) => o.email === email && !o.used_at,
      );
      if (records.length === 0) return null;
      return records.sort((a, b) => b.expires_at - a.expires_at)[0];
    },
    insert: (otp: any) => {
      const rows = readCollection("otp_codes");
      rows.push(otp);
      writeCollection("otp_codes", rows);
    },
    updateAttempts: (id: string, attempts: number) => {
      const rows = readCollection("otp_codes");
      const row = rows.find((o) => o.id === id);
      if (row) {
        row.attempts = attempts;
        writeCollection("otp_codes", rows);
      }
    },
    markUsed: (id: string, used_at: string) => {
      const rows = readCollection("otp_codes");
      const row = rows.find((o) => o.id === id);
      if (row) {
        row.used_at = used_at;
        writeCollection("otp_codes", rows);
      }
    },
  },
};
