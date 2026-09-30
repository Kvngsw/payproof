# PayProof — Security

*Commit `a7bd6ef`, 2026-09-30. Sandbox build, no real funds.*

## Controls

| Layer | Control |
|---|---|
| AuthN | Email + password, then 6-digit OTP (hashed, expiring, attempt-limited). JWT signed with `JWT_SECRET`, role claim `seller` / `buyer` |
| AuthZ | Owner/party checks in the API (primary control); E2E-tested 403s |
| Database | Least-privilege `payproof_app` role (no DDL, no RLS bypass), RLS on all tables, `PUBLIC CREATE` revoked. Migrations run as the owner role |
| Tenant isolation | `GET /products` requires `seller_id` or a seller token; unscoped → `400` |
| Webhook | HMAC-SHA512 over the raw body, header `monnify-signature`; bad signature → `401`. Body is never trusted; payment is re-verified server-side |
| Money safety | Integer kobo; unique `Payment.reference` and `Payout.transferRef`; payout re-checks `Completed` and no dispute in history; Redis idempotency locks |
| Rate limits | Upstash sliding window: auth 5/min, products 30/min |
| PII | BVN: 11-digit validation, stored on the restricted `sellers` table, excluded from public responses |
| Secrets | Env only; gitleaks scan in CI on every PR; branch protection on `main` |
| AI | Snapshot of one order only, no tools, no writes, injection-tested ([AI assistant](AI-ASSISTANT.md)) |

## Authorization matrix (verified on production)

| Endpoint | Attempt | Result |
|---|---|---|
| `POST /products` | No token | `401` |
| `POST /products` | Buyer token | `403` |
| `PATCH /products/:id` | Another seller | `403` |
| `POST /orders/:id/ship` | Buyer | `403` |
| `POST /orders/:id/confirm-delivery` | Seller | `403` |
| `POST /orders/:id/report-issue` | Unrelated user | `403` |
| `GET /orders/:id/payout` | No token | `401` |
| `POST /monnify/webhook` | Bad signature | `401` |
| `POST /orders/:id/confirm-delivery` | Unpaid order | `409` |

## Found and fixed

| ID | Severity | Issue | Fix |
|---|---|---|---|
| BUG-01 | Sev-1 | Unscoped `GET /products` exposed every seller's inventory | `seller_id` required or seller JWT |
| BUG-02 | Sev-2 | Client sent `dispatchFeeKobo: 0`, breaking the two-transfer split | Backend defaults (D20); client stops sending zeros |

## Not done (honest list)

- No auto-release or auto-refund timers; disputes are terminal.
- No KYC or BVN verification against a bureau; BVN is format-checked only.
- No JWT revocation list; no CSRF tokens (bearer-token API).
- No licensed custody: escrow is a sandbox merchant wallet.
- Sandbox webhook and payout behaviour may differ from production Monnify.
