-- Link invoice-born payments so the webhook can flip the invoice paid.
ALTER TABLE payments ADD COLUMN "invoiceId" TEXT;
