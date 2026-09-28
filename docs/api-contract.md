## 7. API contract v1

### 7.1 Conventions

- Base: `/api/v1` · JSON · UTF-8 · timestamps ISO-8601 UTC · ids UUID
- Auth: `Authorization: Bearer <jwt>` · claims `{ sub, role: "seller" | "buyer" }`
- Money: integer **kobo**, NGN
- Error shape: `{ "error": { "code": "INVALID_TRANSITION", "message": "...", "details": {} } }`

| HTTP | Codes |
|---|---|
| 400 | `VALIDATION` |
| 401 | `UNAUTHENTICATED`, `BAD_SIGNATURE` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `INVALID_TRANSITION`, `OUT_OF_STOCK`, `DUPLICATE`, `PAYOUT_FROZEN` |
| 429 | `RATE_LIMITED` (OTP) |
| 502 | `RAIL_ERROR`, `RAIL_TIMEOUT` |

### 7.2 Endpoints

| ID | Method · Path | Auth | Request | Response | Owner card |
|---|---|---|---|---|---|
| E01 | `POST /auth/seller/register` | public | `{name, email, password, phone, business_name}` | `201 {token, seller, reserved_account:{account_number, bank_name, account_name}}` | BE-03 |
| E02 | `POST /auth/seller/login` | public | `{email, password}` | `200 {token, seller, reserved_account}` | BE-03 |
| E03 | `POST /auth/buyer/otp/request` | public | `{email}` | `202 {sent:true, delivery:"email"/"dev_screen", dev_code?}` (`dev_code` only if `OTP_MODE=dev`) | BE-04 |
| E04 | `POST /auth/buyer/otp/verify` | public | `{email, code}` | `200 {token, buyer:{id,email}}` | BE-04 |
| E05 | `GET /auth/me` | any | — | `{role, profile}` | BE-03 |
| E06 | `GET /sellers/:id` | public | — | `{id, business_name, reputation:{score\|null, completed, total, badge}}` | INT-05 |
| E07 | `GET /sellers/me/dashboard` | seller | — | `{reserved_account, counts_by_status, payouts:{pending_kobo, paid_kobo, frozen_kobo}}` | BE-03 / INT-04 |
| E08 | `GET /products?seller_id=` | public | — | `[Product]` | INT-02 |
| E09 | `GET /products/:id` | public | — | `Product` | INT-02 |
| E10 | `POST /products` | seller | `{name, price_kobo, description, image_url, stock_quantity, dispatch_fee_kobo, delivery_days}` | `201 Product` | INT-02 |
| E11 | `PATCH /products/:id` | seller (owner) | partial of E10 | `200 Product` | INT-02 |
| E12 | `POST /orders` | buyer | `{product_id, delivery_address, phone}` | `201 {order, payment:{reference, provider, checkout_url}}` · `409 OUT_OF_STOCK` | BE-07 |
| E13 | `GET /orders?status=` | buyer/seller | — | `[OrderSummary]` (role-scoped) | BE-07 |
| E14 | `GET /orders/:id` | party | — | `Order` (full, incl. `events[]`) — **polling target** | BE-06/07 |
| E15 | `POST /orders/:id/verify` | buyer | — | `200 {order}` — live verify; on rail timeout + `DEMO_FALLBACK=true` uses cached JSON and sets `verification_mode` | BE-11 |
| E16 | `POST /webhooks/rail` | public + signature | provider payload | `200` (always fast; idempotent) · `401 BAD_SIGNATURE` | BE-08 |
| E17 | `POST /orders/:id/ship` | seller (owner) | `{tracking_number?, carrier?}` | `200 {order}` — `Awaiting Shipment → Shipped`, `tracking.status="Picked Up"` | INT-04 |
| E18 | `PATCH /orders/:id/tracking` | seller (owner) | `{tracking_status, tracking_number?}` | `200 {order}` — forward-only; `Delivered` also moves order to `Delivered` | INT-04 |
| E19 | `POST /orders/:id/confirm-delivery` | buyer (owner) | — | `200 {order, payout}` — → `Completed`, triggers payout | INT-04 / BE-10 |
| E20 | `POST /orders/:id/report-issue` | buyer (owner) | `{reason}` (required, ≤500 chars) | `200 {order}` — → `Disputed`, payout frozen | INT-04 |
| E21 | `GET /orders/:id/payout` | party | — | `{status, product_kobo, dispatch_kobo, transfers:[{to, amount_kobo, status, ref}]}` | BE-10 |
| E22 | `POST /orders/:id/assistant` | party | `{message}` | `200 {answer, order_status, scope:"order"}` | BE-12 |
| E23 | `GET /health` | public | — | `{ok:true, version, rail:"paystack"}` | BE-00 |
| E24 | `POST /orders/:id/cancel` | buyer (owner) | — | `200 {order}` — only from `Pending Payment` | INT-04 |

### 7.3 Order object (E14)

```json
{
  "id": "uuid",
  "status": "Awaiting Shipment",
  "product": { "id": "uuid", "name": "Air Runner Sneakers", "image_url": "..." },
  "seller": { "id": "uuid", "business_name": "Ada Kicks", "reputation": { "score": 0.92, "badge": ">90% completed" } },
  "amounts": { "product_kobo": 4500000, "dispatch_fee_kobo": 250000, "total_kobo": 4750000 },
  "delivery_days": 3,
  "delivery_address": "...",
  "tracking": { "status": null, "number": null, "source": "manual", "label": "Manually updated by seller" },
  "payment": { "reference": "pp_ord_xxx", "provider": "paystack", "verification_mode": "live", "paid_at": "..." },
  "payout": { "status": "none" },
  "fraud_flag": { "triggered": false, "state": "insufficient_history", "label": "Rule-based" },
  "events": [ { "from": "Pending Payment", "to": "Paid", "actor": "system", "at": "...", "note": null } ],
  "updated_at": "..."
}
```

- `verification_mode`: `live` / `cached_fallback`. FE banner **iff** `cached_fallback`.
- `tracking.source`: `manual` / `courier_api`. FE label **iff** `manual`. Never hardcode either.
- `payout.status`: `none` / `pending` / `paid` / `frozen` / `partial` / `failed`.

### 7.4 State machine

```
Pending Payment → Paid → Awaiting Shipment → Shipped → Delivered → Completed
       │                                        │          │
       └→ Cancelled                             └──────────┴→ Disputed   (terminal in MVP, D5)
```

| From | To | Actor | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| Pending Payment | Paid | system | E16 / E15 | provider status success, `amount == total_kobo`, currency NGN, not already processed | insert payment · decrement stock (≥0) · fraud rule · event |
| Paid | Awaiting Shipment | system | same txn | — | event |
| Awaiting Shipment | Shipped | seller | E17 | owner | tracking = Picked Up |
| Shipped | Delivered | seller (tracking `Delivered`) or buyer (confirm) | E18 / E19 | owner; tracking forward-only | event |
| Delivered | Completed | buyer | E19 | owner; **not Disputed**; no existing payout | `release()` → 2 transfers |
| Shipped, Delivered | Disputed | buyer | E20 | owner; reason present | **freeze payout**; event |
| Pending Payment | Cancelled | buyer / system | E24 | unpaid only | event |
| any other pair | — | — | — | — | `409 INVALID_TRANSITION` |

E19 from `Shipped`: performs `Shipped → Delivered → Completed` atomically with two events.
**Payout guard (belt and braces):** `release()` re-checks `status == Completed`, no `Disputed` ever in event history, and unique `transfer_ref` per (order, recipient).

### 7.5 Rail interface (rail-agnostic; Paystack first)

```ts
interface RailProvider {
  createReservedAccount(seller): Promise<{ account_number; bank_name; account_name; provider_ref }>;
  initializeTransaction(order): Promise<{ reference; checkout_url }>;          // missing from spec
  verifyTransaction(reference): Promise<{ status; amount_kobo; currency; paid_at; raw }>;
  initiatePayout({ amount_kobo, recipient_code, reference, reason }): Promise<{ status; transfer_ref }>;
  verifyWebhookSignature(headers, rawBody): boolean;                            // missing from spec
}
```

### 7.6 Webhook handling (E16)

1. Keep **raw body** (`express.raw`); verify signature (Paystack `x-paystack-signature` HMAC-SHA512 · Flutterwave `verif-hash`). Bad → `401`.
2. Respond `200` fast.
3. Look up order by `payments.reference`. Unknown → log, ignore.
4. Idempotency: order not in `Pending Payment` → no-op + log.
5. **Never trust webhook body.** Call `verifyTransaction(reference)` server-side.
6. Check status success, `amount_kobo == order.total_kobo`, currency NGN. Mismatch → stay `Pending Payment`, event note `PAYMENT_MISMATCH`.
7. One DB txn: payment row → stock decrement → `Paid` → `Awaiting Shipment` → fraud rule → events.

### 7.7 Payout split

```
splitPayout(productKobo, dispatchKobo) → { sellerKobo: productKobo, logisticsKobo: dispatchKobo }
invariant: sellerKobo + logisticsKobo === order.total_kobo   ← unit-tested (QA-02)
```
No platform fee in MVP. Two `initiatePayout` calls, references `payout_{orderId}_seller` / `payout_{orderId}_logistics`. Second fails → `partial`, fee shown as `HELD` (D6).

### 7.8 Reputation & fraud (real logic only)

```sql
-- D4 version (recommended)
SELECT
  COUNT(*) FILTER (WHERE status = 'Completed')                              AS completed,
  COUNT(*) FILTER (WHERE status IN ('Completed','Cancelled','Disputed'))    AS total,
  COUNT(*) FILTER (WHERE status = 'Completed')::float
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('Completed','Cancelled','Disputed')), 0) AS score
FROM orders WHERE seller_id = $1;

-- Spec-literal version (if D4 rejected): denominator = COUNT(*) of all orders for seller
```
Badge thresholds computed server-side from `score`. **Never hardcode, never mock, never cache stale.**

Fraud rule: `abs(order.total - avg(seller Completed totals)) / avg > 0.5` → `triggered=true`. <3 Completed → `state="insufficient_history"`. UI label always "Rule-based".

### 7.9 AI assistant (E22)

- Input to model: order snapshot JSON (status, events, tracking, payout, delivery_days, amounts) + user message. **No tools, no writes.**
- Answers only from snapshot. Off-scope (general support, negotiation, other orders, prompt-injection) → fixed refusal string from `docs/ai-prompt.md`.
- `max_tokens` ≈ 300. Timeout 10s → `502` + FE shows "Assistant unavailable".
- Never labelled as verifying payments. Fraud flag is never called "AI".

### 7.10 Polling

FE polls E14 every **5s** (10s hidden tab) while status is non-terminal (`Completed`, `Cancelled`, `Disputed`). No websockets.

---