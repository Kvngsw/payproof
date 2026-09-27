const BASE = "/api/mock/auth";

export { getToken, setToken, clearToken } from "./source";
import { getToken, setToken } from "./source";

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Request failed");
  }
  return data;
}

export async function registerSeller(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  business_name: string;
  bvn?: string;
  settlement?: { bankCode: string; accountNumber: string };
}) {
  const res = await fetch(`${BASE}/seller/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res); // Auth v2: 202 + dev_code — no token yet
}

// Auth v2: password check for either role → OTP, token only after /otp verify.
export async function login(payload: { email: string; password: string }) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function registerBuyer(payload: {
  name: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${BASE}/buyer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res); // 202 + dev_code — no token yet
}

export async function verifyAuthOtp(email: string, code: string) {
  const res = await fetch(`${BASE}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await handleResponse(res);
  if (data.token) setToken(data.token);
  return data;
}

export async function loginSeller(payload: { email: string; password: string }) {
  const res = await fetch(`${BASE}/seller/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  if (data.token) setToken(data.token);
  return data;
}

export async function requestOtp(email: string) {
  const res = await fetch(`${BASE}/buyer/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function verifyOtp(email: string, code: string) {
  const res = await fetch(`${BASE}/buyer/otp/verify`, {
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
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

const API = "/api/mock";

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

export type CountsByStatus = Record<string, number>;

export type SellerDashboard = {
  reserved_account: {
    account_number: string;
    bank_name: string;
    account_name: string;
  };
  counts_by_status: CountsByStatus;
  payouts: {
    pending_kobo: number;
    paid_kobo: number;
    frozen_kobo: number;
  };
};

export type MockOrder = {
  id: string;
  status: string;
  buyer_email?: string;
  product: { id: string; name: string; image_url: string };
  seller: { id: string; business_name: string };
  amounts: {
    product_kobo: number;
    dispatch_fee_kobo: number;
    total_kobo: number;
  };
  delivery_days: number;
  delivery_address: string;
  tracking: {
    status: string | null;
    number: string | null;
    carrier?: string | null;
    source: string;
    label: string;
  };
  payment: {
    reference: string;
    provider: string;
    verification_mode: string;
    paid_at: string | null;
  };
  payout: { status: string };
  fraud_flag: {
    triggered: boolean;
    state: string;
    label: string;
  };
  events: {
    from: string;
    to: string;
    actor: string;
    at: string;
    note: string | null;
  }[];
  created_at: string;
  updated_at: string;
};

export async function getSellerDashboard(): Promise<SellerDashboard> {
  return authFetch("/sellers/me/dashboard");
}

export async function listOrders(status?: string): Promise<MockOrder[]> {
  return authFetch(status ? `/orders?status=${encodeURIComponent(status)}` : "/orders");
}

export async function getOrder(id: string): Promise<MockOrder> {
  return authFetch(`/orders/${encodeURIComponent(id)}`);
}

export async function shipOrder(
  id: string,
  payload: { tracking_number?: string; carrier?: string },
): Promise<MockOrder> {
  return authFetch(`/orders/${encodeURIComponent(id)}/ship`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTracking(
  id: string,
  payload: { tracking_status: string; tracking_number?: string },
): Promise<MockOrder> {
  return authFetch(`/orders/${encodeURIComponent(id)}/tracking`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type OrderPayout = {
  status: string;
  product_kobo: number;
  dispatch_kobo: number;
  transfers: unknown[];
};

export type AssistantReply = {
  answer: string;
  order_status: string;
  scope: string;
};

export async function cancelOrder(id: string): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
  return getOrder(id);
}

export async function verifyPayment(id: string): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/verify`, {
    method: "POST",
  });
  return getOrder(id);
}

export async function confirmDelivery(id: string): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/confirm-delivery`, {
    method: "POST",
  });
  return getOrder(id);
}

export async function reportIssue(
  id: string,
  reason: string,
): Promise<MockOrder> {
  await authFetch(`/orders/${encodeURIComponent(id)}/report-issue`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return getOrder(id);
}

export async function getPayout(id: string): Promise<OrderPayout> {
  return authFetch(`/orders/${encodeURIComponent(id)}/payout`);
}

export async function askAssistant(
  id: string,
  message: string,
): Promise<AssistantReply> {
  return authFetch(`/orders/${encodeURIComponent(id)}/assistant`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export type MockProduct = {
  id: string;
  name: string;
  price_kobo: number;
  description: string;
  image_url: string;
  stock_quantity: number;
  created_at: string;
};

export type MockInvoiceItem = {
  product_id: string;
  name: string;
  image_url: string;
  quantity: number;
  unit_price_kobo: number;
};

export type MockInvoice = {
  id: string;
  seller_id: string;
  items: MockInvoiceItem[];
  product_kobo: number;
  total_kobo: number;
  customer: { name: string; contact: string };
  note: string;
  status: "pending" | "paid" | "cancelled";
  order_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export async function listProducts(): Promise<MockProduct[]> {
  return authFetch("/products");
}

export async function createProduct(payload: {
  name: string;
  price_kobo: number;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
}): Promise<MockProduct> {
  return authFetch("/products", { method: "POST", body: JSON.stringify(payload) });
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
  return authFetch(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await authFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listInvoices(): Promise<MockInvoice[]> {
  return authFetch("/invoices");
}

export async function createInvoice(payload: {
  code: string;
  items: { product_id: string; quantity: number }[];
  customer_name: string;
  customer_contact?: string;
  note?: string;
}): Promise<MockInvoice> {
  return authFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelInvoice(id: string): Promise<MockInvoice> {
  return authFetch(`/invoices/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

export async function getInvoice(id: string): Promise<MockInvoice> {
  const res = await fetch(`${API}/invoices/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export function invoiceLink(id: string) {
  if (typeof window === "undefined") return `/invoice/${id}`;
  return `${window.location.origin}/invoice/${id}`;
}
