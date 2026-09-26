-- Track Monnify's transactionReference separately from our payment reference.
-- reference  = OUR idempotency/lookup key (webhook paymentReference, E12).
-- providerRef = THEIR ref (server-side verify calls).
ALTER TABLE payments ADD COLUMN "providerRef" TEXT;
