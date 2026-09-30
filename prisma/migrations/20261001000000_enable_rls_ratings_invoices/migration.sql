-- ratings and invoices were created after prod_hardening, so they never got
-- RLS. Same disposition as that migration: RLS enabled with an app-role policy
-- (row isolation enforced at the API layer; this is the second layer).

GRANT SELECT, INSERT, UPDATE, DELETE ON ratings, invoices TO payproof_app;

ALTER TABLE ratings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_full_access ON ratings  FOR ALL TO payproof_app USING (true) WITH CHECK (true);
CREATE POLICY app_full_access ON invoices FOR ALL TO payproof_app USING (true) WITH CHECK (true);
