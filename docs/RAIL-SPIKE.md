# PayProof 2.0 — Rail Sandbox Spike (BE-01)

Purpose: prove the 5 rail operations actually work in sandbox before anything else depends on them. This doc records what was tried, what worked, and what's flaky — needed for the go/no-go on D12 and for the risk register (B1, B3).


---

## Provider decision (D12)

| | |
|---|---|
| Provider used | **Monnify sandbox** (`sandbox.monnify.com`) |
| Why | Accessible and usable for the team; no dead end on account setup. |
| Backup provider tried? | Not needed — Monnify worked well enough to commit to. |

---

## Spike checklist — did each of these succeed at least once in sandbox?

| Operation | Tried? | Worked? | Notes / errors seen |
|---|---|---|---|
| Initialize a transaction (checkout) | **Yes** | **Yes** | Screenshotted: `sandbox.sdk.monnify.com/checkout/...` renders a real Monnify checkout page with amount, merchant name, transfer/card options. |
| Server generates a dynamic pay-in account per transaction | **Yes** | **Yes** | Checkout page shows a one-time Wema Bank account (`0018905391`, name `HIAMRHEX-PAY`) that "expires in 39 mins" — confirms D1 (hosted-checkout-by-reference, not a persistent per-seller virtual account) is what's actually built. Good — matches the recommended design. |
| Verify a transaction by reference (server-side) | Implied | Implied | "Transaction Successful" screen shown after simulated transfer — but this proves the *sandbox UI* completed, not that your backend's `verifyTransaction()` call independently confirmed it. **[NEEDS INPUT]** — confirm the order actually flipped to `Paid` in your DB/UI after this, not just that Monnify's page said success. |
| Create reserved/virtual account for seller (persistent, not per-transaction) | **Yes** | **Yes — CONFIRMED by Richard.** | Real Sterling Bank reserved account created live via Monnify sandbox API, not manual/stubbed. Distinct from the per-transaction dynamic Wema account in the checkout screenshots — both are real and both exist. |
| Receive + verify a webhook signature | **Yes** | **Yes — CONFIRMED by Richard.** | Public URL confirmed live: `https://payproof-seven.vercel.app`, webhook registered in Monnify as `https://payproof-seven.vercel.app/api/monnify/webhook`. API and web are the **same Vercel app** (Next.js API routes), not a separate backend host — resolves the "where's the API deployed" question. |
| Initiate a transfer/payout to a beneficiary | **Yes** | **Yes — CONFIRMED by Richard.** Seller payout succeeded at ₦9,500. | Formal confirmation received. |
| Initiate a **second** transfer (dispatch fee → logistics beneficiary) | Blocked | **HELD** (Monnify status), per D6 fallback | `LOGISTICS_*` still unfilled. Richard's suggestion: use Richard's own real bank details as the sandbox recipient today to actually exercise this path — sandbox transfers don't move real money. `HELD` is disclosed honestly in the UI per D6 and is an acceptable demo-day state on its own if not unblocked in time. |

---

## Known sandbox gotchas to check for (Monnify specifically)

- Monnify reserved accounts require the contract code (present in env) and an active contract on the sandbox merchant — confirm the account creation call actually returns a real account, not a stub.
- ~~Transfers usually require the sandbox wallet to carry a test balance.~~ **Resolved 2026-09-28:** balance confirmed sufficient and can be topped up.
- Monnify webhook signature is verified via a hash of the transaction reference + amount using the secret key 
- ~~Webhooks need a public URL registered in the Monnify sandbox dashboard.~~ **Resolved:** registered at `https://payproof-seven.vercel.app/api/monnify/webhook`.

