-- Rename PascalCase tables to lowercase conventional names (@@map).
-- Pure RENAME: data-preserving, no column changes.
ALTER TABLE "Seller" RENAME TO sellers;
ALTER TABLE "Buyer" RENAME TO buyers;
ALTER TABLE "OtpCode" RENAME TO otp_codes;
ALTER TABLE "Product" RENAME TO products;
ALTER TABLE "Order" RENAME TO orders;
ALTER TABLE "Payment" RENAME TO payments;
ALTER TABLE "Payout" RENAME TO payouts;
ALTER TABLE "OrderEvent" RENAME TO order_events;
ALTER TABLE "WebhookEvent" RENAME TO webhook_events;
