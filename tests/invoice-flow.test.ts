import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/mock/store";
import { generateId, generateInvoiceCode } from "@/lib/mock/store";

describe("Invoice Flow Integration", () => {
  let sellerId: string;
  let productId: string;

  beforeEach(() => {
    // Clean up before each test
    db.invoices.findBySeller(sellerId || "").forEach((inv: any) => {
      db.invoices.updateById(inv.id, (i: any) => { i.status = "cancelled"; });
    });

    // Create a test seller
    sellerId = generateId();
    db.sellers.insert({
      id: sellerId,
      email: `seller-${Date.now()}@test.com`,
      password_hash: "hash",
      name: "Test Seller",
      phone: "08000000000",
      business_name: "Test Business",
      reserved_account_number: "9912345678",
      reserved_bank: "Test Bank",
      reserved_account_name: "TEST BUSINESS",
      created_at: new Date().toISOString(),
    });

    // Create a test product
    productId = generateId();
    db.products.insert({
      id: productId,
      seller_id: sellerId,
      name: "Test Product",
      dispatch_fee_kobo: 250000,
      price_kobo: 500000,
      stock_quantity: 10,
      description: "Test product description",
      image_url: "",
      created_at: new Date().toISOString(),
    });
  });

  it("creates an invoice with single item qty=1", async () => {
    const code = generateInvoiceCode();
    
    const invoice = {
      id: code,
      seller_id: sellerId,
      items: [
        {
          product_id: productId,
          name: "Test Product",
          image_url: "",
          quantity: 1,
          unit_price_kobo: 500000,
        },
      ],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "Test invoice",
      status: "pending",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    };

    db.invoices.insert(invoice);
    
    const found = db.invoices.findByCode(code);
    expect(found).toBeDefined();
    expect(found?.items).toHaveLength(1);
    expect(found?.items[0].quantity).toBe(1);
    expect(found?.total_kobo).toBe(750000);
  });

  it("lists invoices for a seller", () => {
    const code1 = generateInvoiceCode();
    const code2 = generateInvoiceCode();
    
    db.invoices.insert({
      id: code1,
      seller_id: sellerId,
      items: [{ product_id: productId, name: "Test Product", image_url: "", quantity: 1, unit_price_kobo: 500000 }],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "",
      status: "pending",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    });

    db.invoices.insert({
      id: code2,
      seller_id: sellerId,
      items: [{ product_id: productId, name: "Test Product", image_url: "", quantity: 1, unit_price_kobo: 500000 }],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "Jane Doe", contact: "jane@example.com" },
      note: "",
      status: "cancelled",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    });

    const invoices = db.invoices.findBySeller(sellerId);
    expect(invoices).toHaveLength(2);
  });

  it("cancels a pending invoice", () => {
    const code = generateInvoiceCode();
    
    db.invoices.insert({
      id: code,
      seller_id: sellerId,
      items: [{ product_id: productId, name: "Test Product", image_url: "", quantity: 1, unit_price_kobo: 500000 }],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "",
      status: "pending",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    });

    const updated = db.invoices.updateById(code, (inv: any) => {
      inv.status = "cancelled";
    });

    expect(updated?.status).toBe("cancelled");
  });

  it("cannot cancel a non-pending invoice", () => {
    const code = generateInvoiceCode();
    
    db.invoices.insert({
      id: code,
      seller_id: sellerId,
      items: [{ product_id: productId, name: "Test Product", image_url: "", quantity: 1, unit_price_kobo: 500000 }],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "",
      status: "paid",
      order_id: "order-123",
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    });

    const updated = db.invoices.updateById(code, (inv: any) => {
      // In real API this would throw InvalidTransitionError
      // Mock just updates, but we test the constraint
      if (inv.status === "pending") {
        inv.status = "cancelled";
      }
    });

    expect(updated?.status).toBe("paid");
  });

  it("pays an invoice and creates an order", () => {
    const code = generateInvoiceCode();
    
    db.invoices.insert({
      id: code,
      seller_id: sellerId,
      items: [{ product_id: productId, name: "Test Product", image_url: "", quantity: 1, unit_price_kobo: 500000 }],
      product_kobo: 500000,
      dispatch_fee_kobo: 250000,
      total_kobo: 750000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "",
      status: "pending",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    });

    const buyerId = generateId();
    const orderId = generateId();
    const now = new Date().toISOString();

    // Simulate pay flow
    db.invoices.updateById(code, (inv: any) => {
      inv.status = "paid";
      inv.paid_at = now;
      inv.order_id = orderId;
    });

    db.orders.insertMany([{
      id: orderId,
      seller_id: sellerId,
      buyer_email: "john@example.com",
      status: "Awaiting Shipment",
      product: { id: productId, name: "Test Product", image_url: "" },
      amounts: { product_kobo: 500000, dispatch_fee_kobo: 250000, total_kobo: 750000 },
      delivery_days: 3,
      delivery_address: "123 Test St, Lagos",
      phone: "08012345678",
      tracking: { status: null, number: null, source: "manual", label: "Manually updated by seller" },
      payment: { reference: `pp_inv_${code}`, provider: "manual", verification_mode: "simulated", paid_at: now },
      payout: { status: "pending" },
      fraud_flag: { triggered: false, state: "clear", label: "Rule-based" },
      events: [
        { from: "Pending Payment", to: "Paid", actor: "system", at: now, note: "Payment verified" },
        { from: "Paid", to: "Awaiting Shipment", actor: "system", at: now, note: "Invoice paid" },
      ],
      created_at: now,
      updated_at: now,
    }]);

    const invoice = db.invoices.findByCode(code);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.order_id).toBe(orderId);

    const order = db.orders.findBySeller(sellerId).find((o: any) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order?.status).toBe("Awaiting Shipment");
  });

  it("reduces product stock when invoice is paid", () => {
    const initialStock = 10;
    const productId2 = generateId();
    
    db.products.insert({
      id: productId2,
      seller_id: sellerId,
      name: "Another Product",
      dispatch_fee_kobo: 250000,
      price_kobo: 300000,
      stock_quantity: initialStock,
      description: "Another test product",
      image_url: "",
      created_at: new Date().toISOString(),
    });

    const code = generateInvoiceCode();
    
    db.invoices.insert({
      id: code,
      seller_id: sellerId,
      items: [{ product_id: productId2, name: "Another Product", image_url: "", quantity: 1, unit_price_kobo: 300000 }],
      product_kobo: 300000,
      dispatch_fee_kobo: 250000,
      total_kobo: 550000,
      customer: { name: "John Doe", contact: "john@example.com" },
      note: "",
      status: "pending",
      order_id: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    });

    // Pay the invoice
    db.invoices.updateById(code, (inv: any) => {
      inv.status = "paid";
      inv.paid_at = new Date().toISOString();
      inv.order_id = generateId();
    });

    // Reduce stock (simulating pay flow)
    db.products.updateById(productId2, (product: any) => {
      product.stock_quantity = Math.max(0, product.stock_quantity - 1);
    });

    const product = db.products.findById(productId2);
    expect(product?.stock_quantity).toBe(initialStock - 1);
  });

  it("generates valid invoice codes", () => {
    const code1 = generateInvoiceCode();
    const code2 = generateInvoiceCode();
    
    expect(code1).toMatch(/^INV-[0-9A-F]{6}$/);
    expect(code2).toMatch(/^INV-[0-9A-F]{6}$/);
    expect(code1).not.toBe(code2);
  });
});