import crypto from "node:crypto";
import data from "./data.json";
import { isReadOnly } from "./read-only";

export type CollectionName =
  | "sellers"
  | "buyers"
  | "otp_codes"
  | "orders"
  | "products"
  | "invoices";

// ---------------------------------------------------------------------------
// Storage: static JSON (lib/mock/data.json) cloned into process memory.
// Every server instance boots from the identical dataset, so tokens minted on
// one instance resolve on all of them — no shared filesystem required.
// Local writes mutate only this process's copy (reset on server restart).
// On Vercel all mutations are blocked at the route level (lib/mock/read-only)
// and writeCollection throws as a safety net.
//
// Regenerate the dataset (assigns fresh IDs — invalidates deployed tokens):
//   MOCK_SEED_EMPTY=1 npx tsx scripts/generate-mock-data.ts
// ---------------------------------------------------------------------------

type Collections = Record<CollectionName, any[]>;

const empty: Collections = {
  sellers: [],
  buyers: [],
  otp_codes: [],
  orders: [],
  products: [],
  invoices: [],
};

const state: Collections = process.env.MOCK_SEED_EMPTY
  ? empty
  : structuredClone({
      sellers: data.sellers,
      buyers: data.buyers,
      otp_codes: data.otp_codes,
      orders: data.orders,
      products: data.products,
      invoices: data.invoices,
    });

export function readCollection(name: CollectionName): any[] {
  return state[name];
}

export function writeCollection(name: CollectionName, rows: any[]) {
  if (isReadOnly()) {
    throw new Error("Mock store is read-only on this deployment");
  }
  state[name] = rows;
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
    insert: (seller: object) => {
      const rows = readCollection("sellers");
      rows.push(seller);
      writeCollection("sellers", rows);
    },
    update: (id: string, patch: object) => {
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
    insert: (buyer: object) => {
      const rows = readCollection("buyers");
      rows.push(buyer);
      writeCollection("buyers", rows);
    },
    update: (id: string, patch: object) => {
      const rows = readCollection("buyers");
      const row = rows.find((b) => b.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      writeCollection("buyers", rows);
      return row;
    },
  },
  orders: {
    findBySeller: (sellerId: string) => {
      return readCollection("orders").filter((o) => o.seller_id === sellerId);
    },
    insertMany: (orders: object[]) => {
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
    insert: (product: object) => {
      const rows = readCollection("products");
      rows.push(product);
      writeCollection("products", rows);
    },
    insertMany: (products: object[]) => {
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
    insert: (invoice: object) => {
      const rows = readCollection("invoices");
      rows.push(invoice);
      writeCollection("invoices", rows);
    },
    insertMany: (invoices: object[]) => {
      const rows = readCollection("invoices");
      rows.push(...invoices);
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
    insert: (otp: object) => {
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
