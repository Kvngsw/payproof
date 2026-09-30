# PayProof — Testing and Evidence

*Commit `a7bd6ef`, 2026-09-30.*

## Automated (Vitest, Node 20): 44 tests

| File | Tests | Proves |
|---|---:|---|
| `state-machine.test.ts` | 24 | Every legal transition; illegal pairs return `409 INVALID_TRANSITION`; payout guard blocks release if a dispute exists in history |
| `payout-split.test.ts` | 12 | `sellerKobo + logisticsKobo === total_kobo`; zero/negative rejected; integer kobo only |
| `fraud-rules.test.ts` | 8 | >50% deviation triggers; <3 completed → `insufficient_history` |

## CI (GitHub Actions, every PR to `main`)

gitleaks secret scan · `tsc --noEmit` · Vitest · Prisma schema validation. PR template and branch protection on `main`.

## API contract suite (Postman)

`docs/payproof-v1.postman_collection.json`, run against the live URL. Tests double as contract-drift detectors.

| Area | Checks |
|---|---|
| Health | `GET /health` → 200 |
| Auth | seller register 202, login 202, OTP verify 200, buyer register 202 |
| Catalog | scoped list 200, create 201 with D20 defaults |
| Orders | create 201, get 200, ship 200, confirm 200, report-issue 200 |
| Assistant | in-scope answer 200; off-scope returns the fixed refusal |
| Negative | unscoped products 400, non-owner patch 403, confirm unpaid 409, bad webhook signature 401 |

All listed checks passed on 2026-09-30.

## Live end-to-end run (production)

| Beat | Observed |
|---|---|
| Ada's storefront | 6 completed / 9 finished → "67% completed" |
| Order Air Runner | 4,500,000 + 250,000 = 4,750,000 kobo (₦47,500) |
| Sandbox pay-in | Monnify dynamic account |
| Webhook | Server re-verifies; `Pending Payment → Paid → Awaiting Shipment` |
| Ship → confirm | `Shipped` → `Completed`; payout fires |
| Transfers | 4,500,000 to seller + 250,000 to logistics recipient = total |
| Reputation | 7/10 → "70% completed" |
| Dispute on a second order | `Disputed`, payout `frozen`; 7/11 → "64% completed" |

## Manual smoke path

Seller register → product → checkout → sandbox pay → webhook → ship → confirm → payout → dispute.
