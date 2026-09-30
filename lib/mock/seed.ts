// Demo dataset generator — NOT used at runtime. The app boots from the
// committed lib/mock/data.json instead; this module only runs when
// regenerating it via scripts/generate-mock-data.ts.
import { db, generateId, hashPassword } from "./store";

export const DEMO_SEEDED_EMAIL = "ada@kicks.com";
const DEMO_PASSWORD = "demo1234";

export const ORDER_STATUSES = [
  "Pending Payment",
  "Paid",
  "Awaiting Shipment",
  "Shipped",
  "Delivered",
  "Completed",
  "Disputed",
  "Cancelled",
] as const;

export const TRACKING_STATUSES = [
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
] as const;

const RESERVED_BANK = "Wema Bank";

function randomAccountNumber() {
  return "99" + Math.floor(10000000 + Math.random() * 90000000);
}

function makeDemoSeller() {
  return {
    id: generateId(),
    email: DEMO_SEEDED_EMAIL,
    password_hash: hashPassword(DEMO_PASSWORD),
    name: "Ada Obi",
    phone: "08000000000",
    business_name: "Ada Kicks",
    reserved_account_number: randomAccountNumber(),
    reserved_bank: RESERVED_BANK,
    reserved_account_name: "PP-ADA KICKS",
    created_at: new Date(Date.now() - 90 * 86400_000).toISOString(),
    seeded_demo: true,
  };
}

export function ensureDemoSellers() {
  const existing = db.sellers.findByEmail(DEMO_SEEDED_EMAIL);
  if (!existing) {
    db.sellers.insert(makeDemoSeller());
    return;
  }
  if (!existing.seeded_demo) {
    db.sellers.update(existing.id, { seeded_demo: true });
  }
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// Auth v2: every demo buyer (from SEED_ORDERS) can sign in with a password.
// Backfills passwordless rows left over from the legacy OTP-only flow.
export function ensureBuyerAccounts() {
  const emails = Array.from(new Set(SEED_ORDERS.map((o) => o.buyer_email)));
  for (const email of emails) {
    const existing = db.buyers.findByEmail(email);
    if (!existing) {
      db.buyers.insert({
        id: generateId(),
        name: nameFromEmail(email),
        email,
        password_hash: hashPassword(DEMO_PASSWORD),
        created_at: new Date(Date.now() - 60 * 86400_000).toISOString(),
      });
    } else if (!existing.password_hash) {
      db.buyers.update(existing.id, {
        name: existing.name ?? nameFromEmail(email),
        password_hash: hashPassword(DEMO_PASSWORD),
      });
    }
  }
}

const CHAINS: Record<string, { from: string; to: string; actor: string }[]> = {
  "Pending Payment": [],
  Cancelled: [{ from: "Pending Payment", to: "Cancelled", actor: "buyer" }],
  "Awaiting Shipment": [
    { from: "Pending Payment", to: "Paid", actor: "system" },
    { from: "Paid", to: "Awaiting Shipment", actor: "system" },
  ],
  Shipped: [
    { from: "Pending Payment", to: "Paid", actor: "system" },
    { from: "Paid", to: "Awaiting Shipment", actor: "system" },
    { from: "Awaiting Shipment", to: "Shipped", actor: "seller" },
  ],
  Delivered: [
    { from: "Pending Payment", to: "Paid", actor: "system" },
    { from: "Paid", to: "Awaiting Shipment", actor: "system" },
    { from: "Awaiting Shipment", to: "Shipped", actor: "seller" },
    { from: "Shipped", to: "Delivered", actor: "seller" },
  ],
  Completed: [
    { from: "Pending Payment", to: "Paid", actor: "system" },
    { from: "Paid", to: "Awaiting Shipment", actor: "system" },
    { from: "Awaiting Shipment", to: "Shipped", actor: "seller" },
    { from: "Shipped", to: "Delivered", actor: "seller" },
    { from: "Delivered", to: "Completed", actor: "buyer" },
  ],
  Disputed: [
    { from: "Pending Payment", to: "Paid", actor: "system" },
    { from: "Paid", to: "Awaiting Shipment", actor: "system" },
    { from: "Awaiting Shipment", to: "Shipped", actor: "seller" },
    { from: "Shipped", to: "Disputed", actor: "buyer" },
  ],
};

const PAID_STATUSES = new Set([
  "Awaiting Shipment",
  "Shipped",
  "Delivered",
  "Completed",
  "Disputed",
]);
const TRACKED_STATUSES = new Set([
  "Shipped",
  "Delivered",
  "Completed",
  "Disputed",
]);

type SeedOrder = {
  status: string;
  product_name: string;
  product_kobo: number;
  dispatch_fee_kobo: number;
  days_ago: number;
  address: string;
  buyer_email: string;
  payout_status: string;
  fraud: "cleared" | "triggered" | "insufficient_history";
  dispute_reason?: string;
};

const SEED_ORDERS: SeedOrder[] = [
  {
    status: "Completed",
    product_name: "Air Runner Sneakers",
    product_kobo: 4500000,
    dispatch_fee_kobo: 250000,
    days_ago: 30,
    address: "14 Bode Thomas St, Surulere, Lagos",
    buyer_email: "bisi@example.com",
    payout_status: "paid",
    fraud: "insufficient_history",
  },
  {
    status: "Completed",
    product_name: "Court Classic Loafers",
    product_kobo: 3200000,
    dispatch_fee_kobo: 250000,
    days_ago: 22,
    address: "7 Admiralty Way, Lekki Phase 1, Lagos",
    buyer_email: "chidi@example.com",
    payout_status: "paid",
    fraud: "triggered",
  },
  {
    status: "Completed",
    product_name: "Canvas Slip-Ons",
    product_kobo: 2800000,
    dispatch_fee_kobo: 300000,
    days_ago: 15,
    address: "3 Allen Ave, Ikeja, Lagos",
    buyer_email: "amina@example.com",
    payout_status: "paid",
    fraud: "cleared",
  },
  {
    status: "Completed",
    product_name: "Retro High Tops",
    product_kobo: 5100000,
    dispatch_fee_kobo: 250000,
    days_ago: 9,
    address: "22 Herbert Macaulay Way, Yaba, Lagos",
    buyer_email: "emeka@example.com",
    payout_status: "pending",
    fraud: "cleared",
  },
  {
    status: "Disputed",
    product_name: "Trail Hiker Boots",
    product_kobo: 6750000,
    dispatch_fee_kobo: 350000,
    days_ago: 12,
    address: "9 Adebayo Doherty Rd, Lekki, Lagos",
    buyer_email: "zainab@example.com",
    payout_status: "frozen",
    fraud: "cleared",
    dispute_reason: "Item not as described",
  },
  {
    status: "Cancelled",
    product_name: "Suede Chukka Boots",
    product_kobo: 5400000,
    dispatch_fee_kobo: 250000,
    days_ago: 5,
    address: "1 Awolowo Rd, Ikoyi, Lagos",
    buyer_email: "tunde@example.com",
    payout_status: "none",
    fraud: "cleared",
  },
  {
    status: "Awaiting Shipment",
    product_name: "Air Runner Sneakers",
    product_kobo: 4500000,
    dispatch_fee_kobo: 250000,
    days_ago: 2,
    address: "45 Ogui Rd, Enugu",
    buyer_email: "ngozi@example.com",
    payout_status: "none",
    fraud: "cleared",
  },
  {
    status: "Shipped",
    product_name: "Court Classic Loafers",
    product_kobo: 3200000,
    dispatch_fee_kobo: 250000,
    days_ago: 4,
    address: "6 Zik Ave, Awka, Anambra",
    buyer_email: "kola@example.com",
    payout_status: "none",
    fraud: "cleared",
  },
  {
    status: "Delivered",
    product_name: "Canvas Slip-Ons",
    product_kobo: 2800000,
    dispatch_fee_kobo: 300000,
    days_ago: 7,
    address: "11 Ahmadu Bello Way, Kaduna",
    buyer_email: "hauwa@example.com",
    payout_status: "none",
    fraud: "cleared",
  },
];

function buildOrder(seller: any, spec: SeedOrder, index: number) {
  const created = Date.now() - spec.days_ago * 86400_000;
  const created_at = new Date(created).toISOString();
  const isPaid = PAID_STATUSES.has(spec.status);
  const isTracked = TRACKED_STATUSES.has(spec.status);
  const paid_at = isPaid ? new Date(created + 3600_000).toISOString() : null;

  const chain = CHAINS[spec.status] ?? [];
  const events = chain.map((step, i) => ({
    from: step.from,
    to: step.to,
    actor: step.actor,
    at: new Date(created + (i + 1) * 86400_000).toISOString(),
    note:
      step.to === "Disputed"
        ? spec.dispute_reason ?? "Issue reported by buyer"
        : null,
  }));

  const lastEvent = events[events.length - 1];
  const updated_at = lastEvent ? lastEvent.at : created_at;

  return {
    id: generateId(),
    seller_id: seller.id,
    buyer_email: spec.buyer_email,
    status: spec.status,
    product: {
      id: generateId(),
      name: spec.product_name,
      image_url: "",
    },
    amounts: {
      product_kobo: spec.product_kobo,
      dispatch_fee_kobo: spec.dispatch_fee_kobo,
      total_kobo: spec.product_kobo + spec.dispatch_fee_kobo,
    },
    delivery_days: 3 + (index % 3),
    delivery_address: spec.address,
    tracking: {
      status: isTracked
        ? spec.status === "Shipped"
          ? "Picked Up"
          : "Delivered"
        : null,
      number: isTracked ? `PP-TRK-${100000 + index}` : null,
      source: "manual",
      label: "Manually updated by seller",
    },
    payment: {
      reference: `pp_ord_${(index + 1).toString().padStart(4, "0")}`,
      provider: "paystack",
      verification_mode: "live",
      paid_at,
    },
    payout: { status: spec.payout_status },
    fraud_flag: {
      triggered: spec.fraud === "triggered",
      state: spec.fraud,
      label: "Rule-based",
    },
    events,
    created_at,
    updated_at,
  };
}

export function ensureOrdersForSeller(seller: any) {
  if (!seller.seeded_demo) return;

  const existing = db.orders.findBySeller(seller.id);
  if (existing.length > 0) return;

  db.orders.insertMany(SEED_ORDERS.map((spec, i) => buildOrder(seller, spec, i)));
}

export const SEED_PRODUCTS = [
  {
    name: "Air Runner Sneakers",
    dispatch_fee_kobo: 250000,
    price_kobo: 4500000,
    stock_quantity: 12,
    description: "Lightweight running sneakers with a cushioned sole.",
    image_url: "",
  },
  {
    name: "Court Classic Loafers",
    dispatch_fee_kobo: 300000,
    price_kobo: 3200000,
    stock_quantity: 8,
    description: "Classic leather loafers for court and street.",
    image_url: "",
  },
  {
    name: "Canvas Slip-Ons",
    dispatch_fee_kobo: 250000,
    price_kobo: 2800000,
    stock_quantity: 20,
    description: "Everyday canvas slip-ons, easy on and off.",
    image_url: "",
  },
  {
    name: "Retro High Tops",
    dispatch_fee_kobo: 300000,
    price_kobo: 5100000,
    stock_quantity: 5,
    description: "Retro high-top sneakers with a padded collar.",
    image_url: "",
  },
  {
    name: "Trail Hiker Boots",
    dispatch_fee_kobo: 350000,
    price_kobo: 6750000,
    stock_quantity: 0,
    description: "Waterproof trail boots for rough terrain.",
    image_url: "",
  },
  {
    name: "Suede Chukka Boots",
    dispatch_fee_kobo: 300000,
    price_kobo: 5400000,
    stock_quantity: 6,
    description: "Soft suede chukka boots, smart casual fit.",
    image_url: "",
  },
];

export function ensureProductsForSeller(seller: any) {
  if (!seller.seeded_demo) return;

  const existing = db.products.findBySeller(seller.id);
  const have = new Set(existing.map((p) => p.name));
  const missing = SEED_PRODUCTS.filter((p) => !have.has(p.name));
  if (missing.length === 0) return;

  db.products.insertMany(
    missing.map((p) => ({
      id: generateId(),
      seller_id: seller.id,
      created_at: new Date().toISOString(),
      ...p,
    })),
  );
}

type SeedInvoice = {
  id: string;
  product_kobo: number;
  total_kobo: number;
  customer: { name: string; contact: string };
  note: string;
  status: "pending" | "cancelled";
  created_at: string;
  items: {
    product_name: string;
    image_url: string;
    quantity: number;
    unit_price_kobo: number;
  }[];
};

const SEED_INVOICES: SeedInvoice[] = [
  {
    id: "INV-89D517",
    product_kobo: 5400000,
    total_kobo: 5400000,
    customer: { name: "Samina Mina", contact: "" },
    note: "",
    status: "cancelled",
    created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    items: [
      {
        product_name: "Suede Chukka Boots",
        image_url: "",
        quantity: 1,
        unit_price_kobo: 5400000,
      },
    ],
  },
  {
    id: "INV-C5B0E1",
    product_kobo: 2800000,
    total_kobo: 2800000,
    customer: { name: "Raheem Orekoya", contact: "" },
    note: "",
    status: "pending",
    created_at: new Date(Date.now() - 86400_000).toISOString(),
    items: [
      {
        product_name: "Canvas Slip-Ons",
        image_url: "",
        quantity: 1,
        unit_price_kobo: 2800000,
      },
    ],
  },
];

export function ensureInvoicesForSeller(seller: any) {
  if (!seller.seeded_demo) return;
  if (db.invoices.findBySeller(seller.id).length > 0) return;

  ensureProductsForSeller(seller);
  const products = db.products.findBySeller(seller.id);
  const productIdByName = new Map(
    products.map((p: { id: string; name: string }) => [p.name, p.id]),
  );

  db.invoices.insertMany(
    SEED_INVOICES.map((invoice) => {
      const items = invoice.items.map((item) => ({
        product_id: productIdByName.get(item.product_name) ?? generateId(),
        name: item.product_name,
        image_url: item.image_url,
        quantity: item.quantity,
        unit_price_kobo: item.unit_price_kobo,
      }));
      const dispatchKobo = Math.max(
        0,
        ...items.map((item) => {
          const product = products.find(
            (p: { id: string }) => p.id === item.product_id,
          );
          return Number(product?.dispatch_fee_kobo) || 0;
        }),
      );
      return {
        ...invoice,
        seller_id: seller.id,
        dispatch_fee_kobo: dispatchKobo,
        total_kobo: invoice.product_kobo + dispatchKobo,
        order_id: null,
        paid_at: null,
        items,
      };
    }),
  );
}

export function ensureDemoData() {
  ensureDemoSellers();
  ensureBuyerAccounts();
  const seller = db.sellers.findByEmail(DEMO_SEEDED_EMAIL);
  if (!seller) return;
  ensureOrdersForSeller(seller);
  ensureProductsForSeller(seller);
  ensureInvoicesForSeller(seller);
}
