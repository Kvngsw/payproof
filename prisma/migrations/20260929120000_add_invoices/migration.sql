-- BE-15 invoices: seller-created payment requests (single item, quantity 1 in MVP).
CREATE TABLE invoices (
  id                TEXT NOT NULL PRIMARY KEY,
  "sellerId"        TEXT NOT NULL REFERENCES sellers(id),
  status            TEXT NOT NULL DEFAULT 'pending',
  "customerName"    TEXT NOT NULL,
  "customerContact" TEXT NOT NULL,
  note              TEXT NOT NULL DEFAULT '',
  "productId"       TEXT NOT NULL,
  "productName"     TEXT NOT NULL,
  "imageUrl"        TEXT,
  "unitPriceKobo"   INTEGER NOT NULL,
  "dispatchFeeKobo" INTEGER NOT NULL,
  "totalKobo"       INTEGER NOT NULL,
  "orderId"         TEXT UNIQUE,
  "paidAt"          TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX invoices_sellerId_idx ON invoices("sellerId");
CREATE INDEX invoices_status_idx ON invoices(status);
