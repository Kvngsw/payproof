# PayProof — Judge Guide

Live app: https://payproof-seven.vercel.app · Sandbox only, no real money.
Demo seller **Ada Kicks** starts at **6 completed / 9 finished = 67%** (9 seeded historical orders, disclosed).

## Path A — 30 seconds, no signup

1. Open Ada Kicks' storefront: `https://payproof-seven.vercel.app/s/9f06d985-02c9-4fee-8717-c43b39a281eb`
2. Read the reputation badge (`67% completed`). It is computed from order rows, not stored.
3. Open a product: price and dispatch fee are shown as separate lines.

## Path B — 5 minutes, full loop with your own accounts

You need two email addresses (or `+alias` addresses). OTP codes arrive by real email; check spam.

| # | Do | Expect |
|---|---|---|
| 1 | `/signup` → **seller** → OTP | Dashboard shows a real Monnify sandbox **reserved account** |
| 2 | Add a product (leave dispatch fee blank) | Defaults to ₦2,500 dispatch, 3 days |
| 3 | In a private window: `/signup` → **buyer** → OTP | Buyer session |
| 4 | Open the seller storefront, order the product, enter address + phone | Redirect to Monnify hosted checkout; price and dispatch shown |
| 5 | Choose **Bank Transfer**, complete with the sandbox's simulate-payment option `select "Pay with Bank Transfer" and click "Simulate Payment"` | Order flips to **Awaiting Shipment** via webhook within seconds, no manual verify |
| 6 | Seller: **Mark as Shipped** | Tracking reads *Manually updated by seller* |
| 7 | Buyer: **Confirm Delivery** | `Completed`; payout page shows two transfers (seller, logistics) |
| 8 | Ask the order assistant "Has the seller been paid yet?" then "What other products does this seller sell?" | Answer from order data; second returns the fixed refusal |
| 9 | Place another order, ship it, **Report Issue** with a reason | `Disputed`, payout `frozen`, nothing transferred |

## Path C — Ada's seeded account

Credentials are given in the submission form, not in this repo.

## What to look for

| Claim | Where to check |
|---|---|
| Payment confirmed at source | Step 5: order moves without any buyer action; see [Architecture §3](ARCHITECTURE.md#3-webhook-post-apimonnifywebhook-re-exported-at-apiv1monnifywebhook) |
| Dispatch fee is its own transfer | Step 7 payout page. It goes to a **sandbox proxy** account, or shows **HELD** if the destination is unavailable. No courier partner is integrated |
| Reputation is live | Ada's badge moves `67% → 70%` after a completed order, `→ 64%` after a dispute |
| Honesty | Tracking and fraud labels, the [real-vs-seeded table](../README.md#whats-real-vs-seeded-vs-manual) |

## Known limits you may hit

No auto-refund or auto-release timers; disputes are terminal; one item per order or invoice. See [README](../README.md#what-doesnt-work-yet).
