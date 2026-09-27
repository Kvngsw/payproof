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
| Create reserved/virtual account for seller (persistent, not per-transaction) | [NEEDS INPUT] | [NEEDS INPUT] | Per informal chat, Richard says reserved account works — but the screenshots show the per-transaction dynamic account (above), which is a different thing. Confirm which one exists: a persistent account tied to the seller for their dashboard, separate from the one-off checkout accounts. |
| Receive + verify a webhook signature | [NEEDS INPUT] | [NEEDS INPUT] | `DEMO_FALLBACK=false` currently. No public API URL yet (confirmed) — so this cannot have been proven against your own deployed webhook endpoint yet, only tested locally at best. Flip `DEMO_FALLBACK=true` until a public URL exists and this is proven. |
| Initiate a transfer/payout to a beneficiary | Per informal chat | **Reported working** by Richard | Not yet formally verified/pushed. Confirm with a screenshot or log once he responds. |
| Initiate a **second** transfer (dispatch fee → logistics beneficiary) | **NOT POSSIBLE YET** | **NO** | `LOGISTICS_BANK_CODE`/`ACCOUNT_NUMBER`/`ACCOUNT_NAME` are unfilled placeholders in the env — confirmed still not filled by you. Top priority action, unchanged. |

---

## Known sandbox gotchas to check for (Monnify specifically)

- Monnify reserved accounts require the contract code (present in env) and an active contract on the sandbox merchant — confirm the account creation call actually returns a real account, not a stub.
- Transfers usually require the sandbox wallet to carry a test balance — check `MONNIFY_WALLET_ACCOUNT_NUMBER` actually has funds, or transfers will fail silently or with an insufficient-balance error.
- Monnify webhook signature is verified via a hash of the transaction reference + amount using the secret key — confirm BE-08 implements Monnify's specific scheme, not a generic one copied from Paystack/Flutterwave docs.
- Webhooks need a public URL registered in the Monnify sandbox dashboard — `NEXT_PUBLIC_APP_URL=localhost` strongly suggests this is not yet done.

