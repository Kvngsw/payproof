import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "mock-data");

const COLLECTIONS = ["sellers", "buyers", "otp_codes", "orders"] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export function collectionFile(name: CollectionName) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readCollection(name: CollectionName): any[] {
  try {
    const file = collectionFile(name);
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

export function writeCollection(name: CollectionName, rows: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    collectionFile(name),
    JSON.stringify(rows, null, 2) + "\n",
    "utf-8",
  );
}

export function ensureCollectionFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const name of COLLECTIONS) {
    if (!fs.existsSync(collectionFile(name))) {
      fs.writeFileSync(collectionFile(name), "[]\n", "utf-8");
    }
  }
}

export function generateId() {
  return crypto.randomUUID();
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
