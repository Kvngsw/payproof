import {
  getToken,
  setToken,
  type CountsByStatus,
  type MockInvoice,
  type MockOrder,
  type MockProduct,
  type SellerDashboard,
} from "./mock";

const AUTH = "/api/v1/auth";
const API = "/api/v1";

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Request failed");
  }
  return data;
}

async function authFetch(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// Normalizers: v1 responses → exact mock/FE shapes (docs/api-requests.md W1–W5)
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<string, string> = {
  PendingPayment: "Pending Payment",
  AwaitingShipment: "Awaiting Shipment",
};

const STATUS_CAMEL: Record<string, string> = {
  "Pending Payment": "PendingPayment",
  "Awaiting Shipment": "AwaitingShipment",
};

function display(status: unknown): string {
  const value = String(status ?? "");
  return STATUS_DISPLAY[value] ?? value;
}

function derivePayout(status: string): string {
  if (status === "Disputed") return "frozen";
  if (status === "Completed") return "paid";
  if (["Paid", "Awaiting Shipment", "Shipped", "Delivered"].includes(status)) {
    return "pending";
  }
  return "none";
}

interface RawOrder {
  id?: string;
  status?: string;
  buyer_email?: string;
  buyerEmail?: string;
  product?: { id?: string; name?: string; image_url?: string; imageUrl?: string };
  seller?: { id?: string; business_name?: string; businessName?: string };
  amounts?: { product_kobo?: number; dispatch_fee_kobo?: number; total_kobo?: number };
  productPriceKobo?: number;
  dispatchFeeKobo?: number;
  totalKobo?: number;
  delivery_days?: number;
  deliveryDays?: number;
  delivery_address?: string;
  deliveryAddress?: string;
  tracking?: { status?: string | null; number?: string | null; source?: string; label?: string | null } | null;
  payment?: MockOrder["payment"] | null;
  payout?: { status?: string };
  payoutStatus?: string;
  fraud_flag?: MockOrder["fraud_flag"];
  events?: { from?: string; to?: string; actor?: string; at?: string; note?: string | null }[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

function normalizeOrder(raw: RawOrder): MockOrder {
  const status = display(raw.status);
  const product = raw.product ?? {};
  const amounts = raw.amounts ?? {
    product_kobo: raw.productPriceKobo,
    dispatch_fee_kobo: raw.dispatchFeeKobo,
    total_kobo: raw.totalKobo,
  };
  const rawPayout = raw.payout?.status ?? raw.payoutStatus;
  const payoutStatus =
    status === "Disputed" ? "frozen" : (rawPayout ?? derivePayout(status));

  return {
    id: raw.id,
    status,
    buyer_email: raw.buyer_email ?? raw.buyerEmail ?? undefined,
    product: {
      id: product.id ?? "",
      name: product.name ?? "",
      image_url: product.image_url ?? product.imageUrl ?? "",
    },
    seller: raw.seller
      ? {
          id: raw.seller.id ?? "",
          business_name:
            raw.seller.business_name ?? raw.seller.businessName ?? "",
        }
      : { id: "", business_name: "" },
    amounts: {
      product_kobo: amounts.product_kobo ?? 0,
      dispatch_fee_kobo: amounts.dispatch_fee_kobo ?? 0,
      total_kobo: amounts.total_kobo ?? 0,
    },
    delivery_days: raw.delivery_days ?? raw.deliveryDays ?? 0,
    delivery_address: raw.delivery_address ?? raw.deliveryAddress ?? "",
    tracking: {
      status: raw.tracking?.status ?? null,
      number: raw.tracking?.number ?? null,
      carrier: null,
      source: raw.tracking?.source ?? "manual",
      label: raw.tracking?.label ?? null,
    },
    payment: raw.payment ?? null,
    payout: { status: payoutStatus },
    fraud_flag: raw.fraud_flag ?? {
      triggered: false,
      state: "clean",
      label: "Rule-based",
    },
    events: (raw.events ?? []).map((event) => ({
      from: display(event.from),
      to: display(event.to),
      actor: event.actor ?? "",
      at: event.at ?? "",
      note: event.note ?? null,
    })),
    created_at: raw.created_at ?? raw.createdAt ?? "",
    updated_at: raw.updated_at ?? raw.updatedAt ?? "",
  } as MockOrder;
}

function normalizeProduct(raw: {
  id: string;
  name: string;
  price_kobo?: number;
  priceKobo?: number;
  description?: string;
  image_url?: string;
  imageUrl?: string;
  stock_quantity?: number;
  stockQuantity?: number;
  created_at?: string;
  createdAt?: string;
}): MockProduct {
  return {
    id: raw.id,
    name: raw.name,
    price_kobo: raw.price_kobo ?? raw.priceKobo ?? 0,
    description: raw.description ?? "",
    image_url: raw.image_url ?? raw.imageUrl ?? "",
    stock_quantity: raw.stock_quantity ?? raw.stockQuantity ?? 0,
    created_at: raw.created_at ?? raw.createdAt ?? "",
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function registerSeller(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  business_name: string;
  bvn?: string;
  settlement?: { bankCode: string; accountNumber: string };
}) {
  const res = await fetch(`${AUTH}/seller/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      businessName: payload.business_name,
      bvn: payload.bvn,
      settlement: payload.settlement,
    }),
  });
  const data = await handleResponse(res);
  if (data.token) setToken(data.token);
  return data;
}

export async function loginSeller(payload: {
  email: string;
  password: string;
}) {
  const res = await fetch(`${AUTH}/seller/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  if (data.token) setToken(data.token);
  return data;
}

export async function requestOtp(email: string) {
  const res = await fetch(`${AUTH}/buyer/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function verifyOtp(email: string, code: string) {
  const res = await fetch(`${AUTH}/buyer/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await handleResponse(res);
  if (data.token) setToken(data.token);
  return data;
}

export async function getMe() {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${AUTH}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await handleResponse(res);
  if (data.role !== "seller") return data;

  const profile = data.profile ?? {};
  const reserved = profile.reserved_account;
  return {
    role: data.role,
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      business_name: profile.businessName,
      reserved_account_number: reserved?.account_number,
      reserved_bank: reserved?.bank_name,
      reserved_account_name: reserved?.account_name,
    },
    reserved_account: reserved ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Dashboard & orders
// ---------------------------------------------------------------------------

export async function getSellerDashboard(): Promise<SellerDashboard> {
  const data = await authFetch("/sellers/me/dashboard");
  const counts: CountsByStatus = {};
  for (const [key, value] of Object.entries(data.counts_by_status ?? {})) {
    counts[display(key)] = value as number;
  }
  return {
    reserved_account: data.reserved_account ?? undefined,
    counts_by_status: counts,
    payouts: data.payouts,
  } as SellerDashboard;
}

export async function listOrders(status?: string): Promise<MockOrder[]> {
  const query = status
    ? `?status=${encodeURIComponent(STATUS_CAMEL[status] ?? status)}`
    : "";
  const rows = await authFetch(`/orders${query}`);
  return rows.map(normalizeOrder);
}

export async function getOrder(id: string): Promise<MockOrder> {
  const row = await authFetch(`/orders/${encodeURIComponent(id)}`);
  return normalizeOrder(row);
}

export async function shipOrder(
  id: string,
  payload: { tracking_number?: string; carrier?: string },
): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/ship`, {
    method: "POST",
    body: JSON.stringify({
      tracking_number: payload.tracking_number,
      carrier: payload.carrier,
    }),
  });
  return getOrder(id); // v1 mutation returns a partial object — refetch (W3)
}

export async function updateTracking(
  id: string,
  payload: { tracking_status: string; tracking_number?: string },
): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/tracking`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return getOrder(id); // W3
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function padDescription(description?: string) {
  const clean = (description ?? "").trim();
  if (clean.length >= 10) return clean;
  return `${clean} Details coming soon.`.trim();
}

async function mySellerId(): Promise<string> {
  const me = await getMe();
  const id = (me as { profile?: { id?: string } }).profile?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

export async function listProducts(): Promise<MockProduct[]> {
  const sellerId = await mySellerId();
  const rows = await authFetch(`/products?seller_id=${encodeURIComponent(sellerId)}`);
  return rows.map(normalizeProduct);
}

export async function createProduct(payload: {
  name: string;
  price_kobo: number;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
}): Promise<MockProduct> {
  const body: Record<string, unknown> = {
    name: payload.name,
    priceKobo: payload.price_kobo,
    stockQuantity: payload.stock_quantity ?? 1,
    description: padDescription(payload.description),
    // Platform calculates these for sellers (decision D7) — silent defaults (W4)
    dispatchFeeKobo: 0,
    deliveryDays: 1,
  };
  if (payload.image_url) body.imageUrl = payload.image_url;
  const row = await authFetch("/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeProduct(row);
}

export async function updateProduct(
  id: string,
  payload: Partial<{
    name: string;
    price_kobo: number;
    description: string;
    image_url: string;
    stock_quantity: number;
  }>,
): Promise<MockProduct> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.price_kobo !== undefined) body.priceKobo = payload.price_kobo;
  if (payload.stock_quantity !== undefined)
    body.stockQuantity = payload.stock_quantity;
  if (payload.description !== undefined)
    body.description = padDescription(payload.description);
  if (payload.image_url !== undefined && payload.image_url)
    body.imageUrl = payload.image_url;
  const row = await authFetch(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeProduct(row);
}

export async function deleteProduct(id: string): Promise<void> {
  await authFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Invoices: not implemented on the backend yet (docs/api-requests.md §1.1)
// ---------------------------------------------------------------------------

export async function listInvoices(): Promise<MockInvoice[]> {
  return [];
}

const INVOICES_LIVE_HINT =
  "Invoices run on demo data for now — switch the data source to Demo data.";

export async function createInvoice(): Promise<MockInvoice> {
  throw new Error(INVOICES_LIVE_HINT);
}

export async function cancelInvoice(): Promise<MockInvoice> {
  throw new Error(INVOICES_LIVE_HINT);
}

export async function getInvoice(): Promise<MockInvoice> {
  throw new Error(INVOICES_LIVE_HINT);
}
