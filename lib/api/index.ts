import { getDataSource } from "./source";
import * as mock from "./mock";
import * as live from "./v1-client";

export {
  getDataSource,
  setDataSource,
  useDataSource,
  getToken,
  setToken,
  clearToken,
  type DataSource,
} from "./source";

export type {
  CountsByStatus,
  SellerDashboard,
  MockOrder,
  MockProduct,
  MockInvoiceItem,
  MockInvoice,
  OrderPayout,
  AssistantReply,
} from "./mock";

const isLive = () => getDataSource() === "live";

type RegisterPayload = Parameters<typeof mock.registerSeller>[0];

export function registerSeller(payload: RegisterPayload) {
  return isLive() ? live.registerSeller(payload) : mock.registerSeller(payload);
}

export function registerBuyer(payload: {
  name: string;
  email: string;
  password: string;
}) {
  return isLive() ? live.registerBuyer(payload) : mock.registerBuyer(payload);
}

export function login(payload: { email: string; password: string }) {
  return isLive() ? live.login(payload) : mock.login(payload);
}

export function verifyAuthOtp(email: string, code: string) {
  return isLive() ? live.verifyAuthOtp(email, code) : mock.verifyAuthOtp(email, code);
}

export function loginSeller(payload: { email: string; password: string }) {
  return isLive() ? live.loginSeller(payload) : mock.loginSeller(payload);
}

export function requestOtp(email: string) {
  return isLive() ? live.requestOtp(email) : mock.requestOtp(email);
}

export function verifyOtp(email: string, code: string) {
  return isLive() ? live.verifyOtp(email, code) : mock.verifyOtp(email, code);
}

export function getMe() {
  return isLive() ? live.getMe() : mock.getMe();
}

export function getSellerDashboard() {
  return isLive() ? live.getSellerDashboard() : mock.getSellerDashboard();
}

export function listOrders(status?: string) {
  return isLive() ? live.listOrders(status) : mock.listOrders(status);
}

export function getOrder(id: string) {
  return isLive() ? live.getOrder(id) : mock.getOrder(id);
}

export function shipOrder(
  id: string,
  payload: { tracking_number?: string; carrier?: string },
) {
  return isLive() ? live.shipOrder(id, payload) : mock.shipOrder(id, payload);
}

export function updateTracking(
  id: string,
  payload: { tracking_status: string; tracking_number?: string },
) {
  return isLive()
    ? live.updateTracking(id, payload)
    : mock.updateTracking(id, payload);
}

export function cancelOrder(id: string) {
  return isLive() ? live.cancelOrder(id) : mock.cancelOrder(id);
}

export function verifyPayment(id: string) {
  return isLive() ? live.verifyPayment(id) : mock.verifyPayment(id);
}

export function confirmDelivery(id: string) {
  return isLive() ? live.confirmDelivery(id) : mock.confirmDelivery(id);
}

export function reportIssue(id: string, reason: string) {
  return isLive() ? live.reportIssue(id, reason) : mock.reportIssue(id, reason);
}

export function getPayout(id: string) {
  return isLive() ? live.getPayout(id) : mock.getPayout(id);
}

export function askAssistant(id: string, message: string) {
  return isLive()
    ? live.askAssistant(id, message)
    : mock.askAssistant(id, message);
}

export function listProducts() {
  return isLive() ? live.listProducts() : mock.listProducts();
}

export function createProduct(payload: {
  name: string;
  price_kobo: number;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
}) {
  return isLive() ? live.createProduct(payload) : mock.createProduct(payload);
}

export function updateProduct(
  id: string,
  payload: Partial<{
    name: string;
    price_kobo: number;
    description: string;
    image_url: string;
    stock_quantity: number;
  }>,
) {
  return isLive() ? live.updateProduct(id, payload) : mock.updateProduct(id, payload);
}

export function deleteProduct(id: string) {
  return isLive() ? live.deleteProduct(id) : mock.deleteProduct(id);
}

export function listInvoices() {
  return isLive() ? live.listInvoices() : mock.listInvoices();
}

export function createInvoice(payload: Parameters<typeof mock.createInvoice>[0]) {
  return isLive() ? live.createInvoice() : mock.createInvoice(payload);
}

export function cancelInvoice(id: string) {
  return isLive() ? live.cancelInvoice() : mock.cancelInvoice(id);
}

export function getInvoice(id: string) {
  return isLive() ? live.getInvoice() : mock.getInvoice(id);
}

export function invoiceLink(id: string) {
  return mock.invoiceLink(id);
}
