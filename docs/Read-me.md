# PayProof 2.0

Escrow-style payment protection for informal/social commerce sellers and buyers, with a dispatch-fee split that pays the seller and the logistics partner separately, funds released only on buyer confirmation.

> **Status: hackathon MVP, in progress.** See [What doesn't work yet](#what-doesnt-work-yet) before judging any claim below.

---

## Live links

| | URL |
|---|---|
| Web app | `https://payproof-seven.vercel.app` |
| Repo | `https://github.com/Kvngsw/payproof` (public) |
| API | `https://payproof-seven.vercel.app/api/v1` (same Vercel app as the web frontend) |
| Demo video (backup) | [NEEDS INPUT — not recorded yet, PM-13] |

---

## Setup (target: 3 commands, fresh clone)

```bash
git clone https://github.com/Kvngsw/payproof
cp .env.example .env   # fill in rail sandbox keys — see below
docker compose up      # or: npm install && npm run dev, per apps/api and apps/web
```

**Required env vars**:

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | api | Postgres via Supabase pooler (pgbouncer + direct) |
| `APP_DATABASE_URL` | api | Least-privilege `payproof_app` role — the app never runs as superuser |
| `JWT_SECRET` | api | — |
| `MONNIFY_API_KEY` / `MONNIFY_SECRET_KEY` / `MONNIFY_CONTRACT_CODE` / `MONNIFY_BASE_URL` | api | Monnify sandbox (`sandbox.monnify.com`) |
| `MONNIFY_WALLET_ACCOUNT_NUMBER` | api | Sandbox wallet used for outbound transfers |
| `LOGISTICS_BANK_CODE` / `LOGISTICS_ACCOUNT_NUMBER` / `LOGISTICS_ACCOUNT_NAME` | api | **Still unfilled with a real logistics partner.** Interim fix per D6: use Richard's own bank details as the sandbox recipient to exercise the transfer path end-to-end today. If not filled by demo time, `HELD` is a disclosed, honest fallback state — not a failure. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | api | Live OTP email delivery (SMTP + nodemailer). |
| `GEMINI_API_KEY` | api | Gemini 3.8 Flash, powers the order-scoped AI assistant |
| `DEMO_FALLBACK` | api | Currently `false` — cached-webhook fallback (E15) is off. Consider `true` until the public webhook URL is proven working. |
| `NEXT_PUBLIC_APP_URL` | web | Currently `https://payproof-seven.vercel.app` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | api | Upstash Redis for state shared across serverless instances. |


---

## Architecture

```
Buyer ──┐                                         ┌─→ Seller payout (product price)
        ├─→ Web (Next.js, Vercel) ──→ API ──┬─────┤
Seller ─┘        │                    │      │     └─→ Logistics payout (dispatch fee)
                  │                    │      │
             polls order          Postgres  Rail sandbox (Monnify)
             (E14, every 5s)      (state machine,        │
                                   order_events)   webhook ──→ verify server-side ──→ Paid
```

- **Frontend:** Next.js, deployed on Vercel.
- **Backend:** Next.js API routes — same Vercel deployment as the frontend, not a separate service.
- **DB:** Postgres on **Supabase** (pooler, eu-central-1) — schema in `docs/api-contract.md` (orders, payments, payouts, order_events, products, sellers, buyers).
- **Rail:** Monnify sandbox.
- **AI assistant:** Gemini 2.5 Flash, order-scoped only.

### Security posture

API-layer authorization (owner checks, E2E-tested 403s) is the primary control; the database adds a second layer — least-privilege `payproof_app` role, RLS enabled on all tables, `PUBLIC CREATE` revoked. Unused-index advisor flags are expected on a fresh database and intentionally retained for scale paths.
- **State machine:** `Pending Payment → Paid → Awaiting Shipment → Shipped → Delivered → Completed`, with `Cancelled` and `Disputed` branches. Full transition table in the contract doc.
- **No websockets** — frontend polls order status every 5s.

---

## What's actually live vs seeded vs manual

Be upfront about this on stage — judges find it faster than you'd like.

| Claim | Real? |
|---|---|
| Seller reserved account | **LIVE** — real Monnify sandbox call|
| Payment verification | Server-side `verifyTransaction()` call against Monnify, not just trusting the webhook body — **[NEEDS INPUT: confirm this is how Richard built E16]** |
| Dispatch-fee split | **Product-side payout executed in sandbox** (₦9,500 seller transfer). The dispatch-fee transfer to a second recipient is **not yet proven**; until it is, the UI shows the fee as HELD. |
| Delivery tracking | Manually updated by seller, not pulled from a courier API. Labelled "Manually updated by seller" in the UI. |
| Reputation score | Computed live from order rows: completed ÷ finished orders (completed + cancelled + disputed). In-flight orders are excluded. Demo sellers are seeded with 9 historical orders each (disclosed); new orders change the score. Differs from the spec's "all orders" denominator (decision-log D4). |
| Fraud flag | Rule-based (deviation from seller's average order value), not ML. Labelled "Rule-based" in the UI. |
| AI assistant | Order-scoped only; cannot act on the order, only answer questions about it. |

### Demo credentials (mock/demo mode)

One sign-in form for both roles — email + password, then a 6-digit OTP (in demo mode the
code is shown in the card banner on `/otp`, and the form accepts it directly).

| Role | Email | Password |
|---|---|---|
| Seller | `ada@kicks.com` | `demo1234` |
| Buyer | `hauwa@example.com`, `kola@example.com`, `ngozi@example.com`, `bisi@example.com`, `chidi@example.com`, `amina@example.com`, `emeka@example.com`, `zainab@example.com`, `tunde@example.com` | `demo1234` |

Sign-up: `/signup` → buyer (single form) or seller (single form, name/email/password only) → OTP → dashboard. New sellers see a **Finish your profile** card on the dashboard home (business name, phone, BVN, settlement account — demo data).

---

## What doesn't work yet

*(Fill in as things get cut — do this continuously, not at the end.)*

- [x] Invoices — backend endpoints live (`/invoices` list/create/authenticated-get/cancel + pay→order, api-requests.md §1.1); FE wired with auth, contact-match buyer access, Monnify checkout redirect (decision-log D19b/D22).
- [ ] No refund or auto-cancel for paid orders that never ship — funds stay held, seller unpaid
- [ ] No auto-release if a buyer never confirms delivery
- [ ] Cancelled (unpaid) orders count against seller reputation (decision-log D21)
- [ ] **[NEEDS INPUT]** — buyer reviews (parked, spec item 19)
- [ ] **[NEEDS INPUT]** — courier-API tracking via Shipbubble sandbox (2h time-boxed stretch, spec item 20). If attempted and it works, this line comes out; if dropped or it fails, tracking stays manual with the "Manually updated by seller" label — that's the spec's own default, not a shortfall. See decision-log D18 for why Shipbubble specifically and not the other named providers.
- [ ] Disputed orders have no resolution flow in this MVP — payout stays frozen permanently
- [ ] No cart/multi-quantity support — one unit per order
- [ ] *(add anything else that gets cut during the build)*

---

## Testing

- **Automated (CI):** `npx vitest run` in GitHub Actions — state-machine transition guards and the payout-split invariant (`sellerKobo + logisticsKobo === total_kobo`). Passing.
- **Repo hygiene (CI):** gitleaks secret scan on PRs, PR template, branch protection on `main`.
- **API contract:** Postman collection at `docs/payproof-v1.postman_collection.json` (E01–E24, guard tests, pending invoice endpoints).
- **Manual smoke path:** seller register → product listed → checkout → sandbox pay → webhook → ship → confirm delivery → payout → dispute path.

## Team

| Role | Person |
|---|---|
| Backend lead | hiamrhex |
| Frontend lead | xpektra7 |
| PM / pitch/ integration+QA | kvngsw |