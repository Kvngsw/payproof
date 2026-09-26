const BASE = "/api/mock/auth";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pp_token");
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pp_token", token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("pp_token");
}

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
}) {
  const res = await fetch(`${BASE}/seller/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
