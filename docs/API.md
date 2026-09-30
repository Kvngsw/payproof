# PayProof — API Reference

*Commit `a7bd6ef`, 2026-09-30. Base: `/api/v1` · JSON · ISO-8601 UTC · UUID ids · money = integer **kobo** (NGN).*

## Conventions

- Auth: `Authorization: Bearer <jwt>`, claims `{ sub, role: "seller" | "buyer" }`. Obtain via login → OTP verify.
- Error shape: `{ "error": { "code": "INVALID_TRANSITION", "message": "...", "details": {} } }`

| HTTP | Codes |
|---|---|
| 400 | `VALIDATION` |
| 401 | `UNAUTHENTICATED`, `BAD_SIGNATURE` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `INVALID_TRANSITION`, `OUT_OF_STOCK`, `DUPLICATE`, `PAYOUT_FROZEN`, `PRODUCT_HAS_ORDERS` |
| 429 | `RATE_LIMITED` |
| 502 | `RAIL_ERROR`, `RAIL_TIMEOUT` (assistant: "Assistant unavailable") |

Auth scopes: **Public** · **Auth** (any token) · **Seller** · **Buyer** · **Owner** (resource owner) · **Party** (buyer or seller of that order).

## Endpoints

### Auth
| ID | Method · Path | Scope | Body | Success |
|---|---|---|---|---|
| E01 | `POST /auth/seller/register` | Public | `{name, email, password, phone?, business_name?}` | `202` (OTP sent; seller + reserved account created) |
| E01b | `POST /auth/buyer/register` | Public | `{name, email, password}` | `202` |
| E02 | `POST /auth/login` | Public | `{email, password}` | `202` (OTP sent) |
| E03 | `POST /auth/otp/request` | Public | `{email}` | `202` · `429` |
| E04 | `POST /auth/otp/verify` | Public | `{email, code}` | `200 {token, …}` |
| E05 | `GET /auth/me` | Auth | — | `200` identity + profile |
| E05b | `PATCH /auth/me` | Auth | `{name?, phone?, business_name?, bvn?, settlement?}` | `200` |

### Sellers
| E06 | `GET /sellers/:id` | Public | — | `{id, business_name, reputation:{score\|null, completed, total, badge}}` |
|---|---|---|---|---|
| E07 | `GET /sellers/me/dashboard` | Seller | — | `{reserved_account, counts_by_status, payouts:{pending_kobo, paid_kobo, frozen_kobo}}` |

### Products
| ID | Method · Path | Scope | Body | Success |
|---|---|---|---|---|
| E08 | `GET /products?seller_id=` | Public (needs `seller_id`) or Seller | — | `200 [Product]` · `400` if unscoped |
| E09 | `GET /products/:id` | Public | — | `200` |
| E10 | `POST /products` | Seller | `{name, priceKobo, description, imageUrl?, stockQuantity?, dispatchFeeKobo?, deliveryDays?}` | `201`. Omitted/0 dispatch → `250000`; days → `3` |
| E11 | `PATCH /products/:id` | Owner | partial of E10 | `200` |
| E11b | `DELETE /products/:id` | Owner | — | `200` · `409 PRODUCT_HAS_ORDERS` |

### Orders
| ID | Method · Path | Scope | Body | Success |
|---|---|---|---|---|
| E12 | `POST /orders` | Buyer | `{productId, deliveryAddress, phone}` | `201 {order, payment:{reference, provider, checkout_url}}` · `409 OUT_OF_STOCK` |
| E13 | `GET /orders?status=` | Auth | — | `200` role-scoped list |
| E14 | `GET /orders/:id` | Party | — | `200` full order incl. `events[]` (polling target) |
| E15 | `POST /orders/:id/verify` | Buyer | — | `200` live re-verify; `502` on rail failure |
| E17 | `POST /orders/:id/ship` | Owner (seller) | `{tracking_number?, carrier?}` | `200` → `Shipped`, tracking `Picked Up` |
| E18 | `PATCH /orders/:id/tracking` | Owner (seller) | `{tracking_status, tracking_number?}` | `200` forward-only |
| E19 | `POST /orders/:id/confirm-delivery` | Owner (buyer) | — | `200 {order, payout}` → `Completed`, payout fires |
| E20 | `POST /orders/:id/report-issue` | Owner (buyer) | `{reason}` ≤500 | `200` → `Disputed`, payout `frozen` |
| E21 | `GET /orders/:id/payout` | Party | — | `{status, product_kobo, dispatch_kobo, transfers:[{to, amount_kobo, status, ref}]}` |
| E22 | `POST /orders/:id/assistant` | Party | `{message}` | `200 {answer, order_status, scope:"order"}` · `502` |
| E24 | `POST /orders/:id/cancel` | Owner (buyer) | — | `200` only from `Pending Payment` |

### Invoices
| ID | Method · Path | Scope | Body | Success |
|---|---|---|---|---|
| E25 | `GET /invoices` | Seller | — | `200` newest first |
| E26 | `POST /invoices` | Seller | `{items:[{productId, quantity}], customerName, customerContact, note?}` (live: 1 item × qty 1) | `201` (`INV-XXXXXX`) · `409 OUT_OF_STOCK` |
| E27 | `GET /invoices/:id` | Public | — | `200` + `seller.business_name` |
| E28 | `POST /invoices/:id/cancel` | Owner | — | `200` · `409` unless `pending` |

Paying an invoice creates a normal order through the same checkout and payout split. Paying a cancelled or paid invoice → `409`.

### System
| E16 | `POST /api/monnify/webhook` | Monnify (signed) | provider payload | `200` always fast · `401 BAD_SIGNATURE` |
|---|---|---|---|---|
| E23 | `GET /health` | Public | — | `{ok:true, version, rail:"monnify"}` |

## Order object (E14)

```json
{
  "id": "uuid",
  "status": "Awaiting Shipment",
  "product": { "id": "uuid", "name": "Air Runner Sneakers", "image_url": "..." },
  "seller": { "id": "uuid", "business_name": "Ada Kicks", "reputation": { "score": 0.67, "badge": "67% completed" } },
  "amounts": { "product_kobo": 4500000, "dispatch_fee_kobo": 250000, "total_kobo": 4750000 },
  "delivery_days": 3,
  "tracking": { "status": null, "number": null, "source": "manual", "label": "Manually updated by seller" },
  "payment": { "reference": "pp_ord_xxx", "provider": "monnify", "verification_mode": "live", "paid_at": "..." },
  "payout": { "status": "none" },
  "fraud_flag": { "triggered": false, "state": "insufficient_history", "label": "Rule-based" },
  "events": [ { "from": "Pending Payment", "to": "Paid", "actor": "system", "at": "...", "note": null } ]
}
```

- `verification_mode`: `live` | `cached_fallback` (UI banner only for the latter).
- `tracking.source`: `manual` | `courier_api` (UI label only for `manual`).

## Known response deviations (handled in the client)

| Item | Contract | Live behaviour |
|---|---|---|
| Status strings | Spaced (`Awaiting Shipment`) | Some responses camelCase; FE `STATUS_DISPLAY` shim |
| Field casing | snake_case | Some camelCase; FE adapters |
| Register / login | `201` / `200` | `202` (OTP step follows) |
