# PayProof 2.0

Escrow-style payment protection for informal/social commerce sellers and buyers, with a dispatch-fee split that pays the seller and the logistics partner separately, funds released only on buyer confirmation.

> **Status: hackathon MVP, in progress.** See [What doesn't work yet](#what-doesnt-work-yet) before judging any claim below.

---

## Live links

| | URL |
|---|---|
| Web app | `https://payproof-seven.vercel.app` |
| Repo | `https://github.com/Kvngsw/payproof` (public) |
| API | `https://payproof-seven.vercel.app`  |
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
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | api | `https://happy-stork-303744.upstash.io` (in-memory only, unsafe on serverless)


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
- **Backend:** Express/TS API — **[NEEDS INPUT: hosting provider — not yet deployed publicly per env config]**.
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
| Dispatch-fee split | **NOT YET REAL.** Logistics beneficiary details are still placeholders in the env — the second transfer has not been attempted. Do not claim this live until D6 is unblocked. |
| Delivery tracking | Manually updated by seller, not pulled from a courier API. Labelled "Manually updated by seller" in the UI. |
| Reputation score | Computed from real seed data (historical orders inserted as real rows), not hardcoded. |
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

- [ ] Invoices — frontend flow built and working against a local mock; backend endpoints (`/invoices`, see api-requests.md S1.1) not yet confirmed live. Ruled in scope 2026-09-27 (decision-log D19b) — confirm build status with Richard. 
- [ ] **[NEEDS INPUT]** — buyer reviews (parked, spec item 19)
- [ ] **[NEEDS INPUT]** — courier-API tracking via Shipbubble sandbox (2h time-boxed stretch, spec item 20). If attempted and it works, this line comes out; if dropped or it fails, tracking stays manual with the "Manually updated by seller" label — that's the spec's own default, not a shortfall. See decision-log D18 for why Shipbubble specifically and not the other named providers.
- [ ] Disputed orders have no resolution flow in this MVP — payout stays frozen permanently
- [ ] No cart/multi-quantity support — one unit per order
- [ ] *(add anything else that gets cut during the build)*

---

## Testing

## Testing

- Automated: **reported live in CI** (`npx vitest run` in `.github/workflows/ci.yml`, per QA channel update) — **not yet independently verified** that the specific invariant assertions (state-machine transition guards, `sellerKobo + logisticsKobo === order.total_kobo`) are actually among the passing tests, versus a test runner existing with lighter coverage. Confirm by reading the suite before checking QA-02 off.
- Repo hygiene: PR template, gitleaks CI scan, and a locked `.gitignore` **confirmed** (OPS-01, per QA channel update) 
- Manual smoke path: seller register → product listed → checkout → sandbox pay → webhook → ship → confirm delivery → payout → dispute path.

---

## Team

| Role | Person |
|---|---|
| Backend lead | hiamrhex |
| Frontend lead | xpektra7 |
| PM / pitch/ integration+QA | kvngsw |