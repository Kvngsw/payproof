import { Database } from "bun:sqlite";
import crypto from "node:crypto";

let dbInstance: Database | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database("mock.db", { create: true });
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS sellers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        business_name TEXT NOT NULL,
        reserved_account_number TEXT NOT NULL,
        reserved_bank TEXT NOT NULL,
        reserved_account_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS buyers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        used_at TEXT
      );
    `);
  }
  return dbInstance;
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

