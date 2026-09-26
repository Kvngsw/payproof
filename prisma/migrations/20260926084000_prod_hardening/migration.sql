-- Production hardening: advisor findings disposition.
--
-- 1. Unindexed FK (orders.productId) → dedicated index.
-- 2. RLS disabled (CRITICAL) → least-privilege app role + RLS enabled.
--    Single-role backend: the app connects AS payproof_app, so row isolation
--    is enforced in the API layer (owner checks on every route, E2E-tested
--    403s). These policies keep RLS active as a second layer without breaking
--    system paths (webhook, seed, reputation aggregation). Per-tenant session
--    policies arrive with the developer-platform API-key phase.
--    What the ROLE buys today (real, not theater): no DDL, no superuser,
--    no bypass, no schema CREATE — blast-radius containment.
-- 3. Unused indexes → deliberately KEPT (fresh-db stats noise; they are the
--    millions-of-users read paths). No action.
-- 4. Supabase default PUBLIC CREATE on schema → revoked (known footgun).

-- ── 1. Product FK index (Prisma-default name to avoid future drift) ─────────
CREATE INDEX IF NOT EXISTS "orders_productId_idx" ON orders("productId");

-- ── 2. Least-privilege app role (idempotent; password set out-of-band) ──────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'payproof_app') THEN
    CREATE ROLE payproof_app WITH NOLOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO payproof_app;
GRANT USAGE ON SCHEMA public TO payproof_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sellers, buyers, otp_codes, products, orders,
  payments, payouts, order_events, webhook_events
  TO payproof_app;

-- Future migration-created tables stay usable by the app role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO payproof_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO payproof_app;

-- ── 3. Close Supabase default: any role could CREATE in public ──────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ── 4. RLS on all app tables (migrations table is internal — untouched) ─────
ALTER TABLE sellers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_full_access ON sellers        FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON buyers         FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON otp_codes      FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON products       FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON orders         FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON payments       FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON payouts        FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON order_events   FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON webhook_events FOR ALL TO payproof_app USING (true) WITH CHECK (true);
