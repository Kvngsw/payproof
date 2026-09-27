# PayProof 2.0 — Decision Log

Format: `ID · Question · Ruling · Rationale · Status`. 

---

## Core rulings (from MVP spec gaps)

| ID | Question | Ruling | Rationale | Status |
|---|---|---|---|---|
| D1 | What does the buyer actually pay into? | Hosted checkout / init-transaction keyed by order reference. Reserved account = seller's settlement identity on their dashboard, not the buyer's payment target. | Transfers into a virtual account carry no order reference — unreliable matching live. | **NEEDS INPUT** — confirm this is what Richard built. If he built direct-transfer-to-reserved-account matching, say so; that changes E12/E16. |
| D2 | Who triggers `Delivered`? | Seller sets tracking to `Delivered` (claim, order shows "awaiting buyer confirmation"). Buyer **Confirm Delivery** (from `Shipped` or `Delivered`) moves to `Completed` and fires payout. | Spec doesn't say; this keeps "funds release only after buyer confirms." | DEFAULT |
| D3 | Does `Cancelled` exist as a state? | Yes — terminal, reachable only from `Pending Payment`. | Spec seeds Cancelled history but the machine as specified has no such state. | DEFAULT |
| D4 | Reputation denominator | `Completed / (Completed + Cancelled + Disputed)` — terminal orders only. | Spec-literal formula (all orders) drops the badge whenever someone has an order in flight. | DEFAULT |
| D5 | Disputed resolution | Terminal in MVP. Payout frozen, no resolution flow. | No time/spec for a resolution flow. | DEFAULT |
| D6 | Dispatch-fee destination | Second sandbox beneficiary, labelled "Logistics partner (sandbox)." If second transfer fails: fee status `HELD`, shown in UI. | Only way to actually demo the fee-split differentiator live. | **BLOCKED — ACT NOW.** `LOGISTICS_BANK_CODE`, `LOGISTICS_ACCOUNT_NUMBER`, `LOGISTICS_ACCOUNT_NAME` are all `<FILL>` in the env file — the second beneficiary has not been created. The dispatch-fee split cannot work, let alone be tested, until this is filled in. This is now the single highest-priority blocker in the whole project (see §Unblock below). |
| D7 | Product/order shape | Quantity fixed at 1. Seller sets `dispatch_fee_kobo` + `delivery_days` per product. | Cuts cart logic entirely — not in spec. | DEFAULT |
| D8 | Currency/units | Integer kobo, NGN only, everywhere. | Rail APIs use minor units; floats are a bug magnet. | CONFIRMED  |
| D9 | Product images | `image_url` string or static asset. No upload pipeline. | Not in spec; upload pipeline is pure scope creep this week. | DEFAULT |
| D10 | Stock handling | Checked at order create, decremented on `Paid` in the same DB transaction. | Simple, correct enough for demo scale. | DEFAULT |
| D11 | Buyer OTP delivery | Resend for live email; `OTP_MODE=dev` (currently active) returns the code in the API response, no email sent. | Email delivery is a classic live-demo failure point — dev mode sidesteps it for now. | **CONFIRMED** (currently `dev` mode). Switch to `live` only after a rehearsal confirms Resend delivery is fast enough; if not, stay in `dev` and keep the on-screen banner. |
| D12 | Rail provider | **Monnify sandbox**, `MONNIFY_BASE_URL=https://sandbox.monnify.com`. | Accessible for use in sandbox; team committed to it. | **CONFIRMED.** |
| D13 | Hosting | Web on Vercel. DB on Supabase. | Public URL needed for webhooks. | **PARTIALLY CONFIRMED.** DB confirmed. `NEXT_PUBLIC_APP_URL` in the env is still `http://localhost:3000` — **NEEDS INPUT: is the API deployed anywhere yet, or is Vercel currently pointing at a local backend?** This blocks webhook delivery entirely if not resolved. | 
| D14 | Submission deadline (`F`) | **00:00, 29 September** Working submit target: **23:00, 28 Sep** (1h safety buffer). Feature freeze target: **19:00, 28 Sep**. Code freeze target: **22:00, 28 Sep**. | Official deadline is midnight; buffer times are ours, not organizer-set. | **CONFIRMED.** |
| D15 | Fraud flag behaviour | Informational only, never blocks payment. Needs ≥3 Completed orders of seller history, else `insufficient_history`. | Avoids a false block killing the live demo. | DEFAULT 
|  D16 | AI model | Gemini 2.5 Flash. | Already keyed and wired per env file. | **CONFIRMED** |
| D17 | DB security posture | API-layer authorization (owner checks, E2E-tested 403s) is primary; DB adds a second layer — least-privilege `payproof_app` role (no DDL, no bypass), RLS enabled on all tables, `PUBLIC CREATE` revoked. Unused-index advisor flags on a fresh DB are expected and intentionally retained for scale paths. | Stated by team for README. | **CONFIRMED**  |
| D18 | Third-party logistics/courier API integration (GIG Logistics, Sendbox, Kwik, Konga, Kobo360, Shipbubble) | Spec's own stretch item (`~2hr time-boxed, droppable`) stands. Assessment below; recommended approach: attempt **Shipbubble** specifically if INT-07 is attempted at all. | See assessment table below — Shipbubble is the only one of the six with a public, self-serve sandbox; the rest require a merchant/API-user relationship that can't be set up in a time-box. | CONFIRMED |
 
### D18 — logistics/courier API assessment (was this in the spec? how would each integrate?)
 
**Yes — named explicitly in the spec, as the stretch tracking item:** *"Stretch, time-boxed (~2 hrs): if a Nigerian courier sandbox (GIGL, Kwik, Sendbox) integrates fast enough, poll it and display real tracking status... Drop if not working within the time-box."* Also listed in the spec's cut list as *"the only... droppable"* item, and its outcome must be disclosed in the README either way. Scope is narrow: this is a **tracking-status poll**, not fulfillment, rate shopping, booking, or payment — you already escrow and pay out yourselves; a courier integration here only needs to answer "where's the package."
 
| Provider | Self-serve sandbox? | How it would integrate | Verdict for a 2h time-box |
|---|---|---|---|
| **Shipbubble** | **Yes.** Public docs at docs.shipbubble.com — register, generate a `sb_sandbox_...` test key, enable API access, done. Has a dedicated Tracking endpoint (`GET /shipments`) and a **webhook simulator built for sandbox testing**. | Create shipment via their API (or seed a fake shipment ID if only tracking display matters), poll/webhook their tracking status, map their status enum to your `tracking_status` values, flip `tracking.source` to `courier_api`. | **Only realistic candidate.** Matches the spec's "poll it" framing almost exactly, and the sandbox webhook simulator lets you demo state changes without a real courier ever moving. |
| **Sendbox** | **No confirmed self-serve path.** Public material mentions "developer APIs" exist, but no public docs/sandbox signup found — implies a merchant relationship/manual onboarding. | Would need to contact Sendbox directly for API credentials; not something obtainable and testable inside a time-box. | Drop — can't be evaluated fast enough to know if it'd even work. |
| **Kwik (Kwik.Delivery)** | **No.** Their own integration docs (e.g. the WooCommerce plugin) show credentials are "provided by the Kwik team by creating an API user account" — a manual, per-merchant provisioning step, not instant sandbox signup. | Same blocker as Sendbox — you'd be waiting on a human at Kwik before writing any code. | Drop. |
| **GIG Logistics (GIGL)** | **No public developer sandbox found.** The only accessible "GIGL tracking API" in search results is via third-party aggregators (e.g. TrackingMore), which is a second paid vendor layered on top of GIGL, not GIGL's own API. | Would mean paying for/integrating a tracking aggregator instead of GIGL directly. | Drop for this time-box — reconsider post-hackathon only via an aggregator, not GIGL direct. |
| **Konga Logistics** | Not evaluated in depth — smaller/less documented footprint than the above four, no clear self-serve dev portal found. | — | Drop — not enough signal to justify time here at all. |
| **Kobo360** | N/A for this use case regardless of sandbox access — it's a heavy-cargo/long-haul freight/trucking platform (booking trucks for bulk freight), not last-mile parcel tracking. | — | **Not a fit at any time budget** — wrong product category, not a scope/time issue. |
 
**Recommendation:** if INT-07 is attempted, point Samuel/whoever picks it up at **Shipbubble only**, hard time-boxed to 2h as the spec already says, droppable per the existing cut ladder. Don't split time evaluating the other five — none are reachable inside a time-box on the evidence found. If it's dropped or fails, the fallback is exactly what's already built: manual seller-updated tracking with the "Manually updated by seller" label — that's not a consolation prize, it's the spec's own default path, not a failure state.
 
**For future/post-hackathon roadmap:** worth revisiting Shipbubble (or Sendbox, if a merchant relationship is established) once there's runway to actually go through onboarding — but note none of these are free; expect per-shipment or subscription costs that would need to be priced into or absorbed separately from the dispatch fee, which is a product decision for later, not a hackathon one.
 
---
 
## Ad hoc decisions (log as they happen)
 
| Date | Decision | By | Notes |
|---|---|---|---|
| | | | |
 
---
 