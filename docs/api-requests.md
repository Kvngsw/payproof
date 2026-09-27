# API requests & parity notes — Frontend → Backend

> From the frontend team. Everything here is actionable: each item says what exists today,
> what we need, and what the frontend does **in the meantime** so nothing is blocked.
> Update the parity matrix (§5) when an item lands. Keep this file in the repo — it is the
> living handoff doc for `/api/v1`.

Base URL: `https://payproof-seven.vercel.app/api/v1` · errors already compatible (`{error:{code,message}}` — no change needed).

---

## 1. Endpoints to build

### 1.1 Invoices (highest priority — 4 of 8 dashboard pages depend on this)

Sellers create shareable payment requests. The full flow is live against our local mock API
(`app/api/mock/invoices/**`) and the contract below is exactly what the frontend ships today —
please mirror it so the UI works unmodified when switched to `live`.

**Suggested Prisma models**

```prisma
model Invoice {
  id         String        @id                 // "INV-XXXXXX" (also the public code)
  sellerId   String
  seller     Seller        @relation(fields: [sellerId], references: [id])
  status     String        @default("pending") // pending | paid | cancelled
  customerName  String
  customerContact String
  note       String        @default("")
  subtotalKobo Int
  totalKobo  Int           // = subtotalKobo today (platform computes dispatch/delivery at checkout)
  orderId    String?       // set when the invoice is paid and an order is born
  items      InvoiceItem[]
  createdAt  DateTime      @default(now())
  paidAt     DateTime?
}

model InvoiceItem {
  id           String  @id @default(cuid())
  invoiceId    String
  invoice      Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  productId    String
  name         String  // snapshot at creation
  imageUrl     String  @default("")
  quantity     Int
  unitPriceKobo Int    // snapshot at creation
}
```

**Endpoints** (seller auth = `Authorization: Bearer <token>`; codes are case-insensitive):

| Method | Path | Notes |
|---|---|---|
| `GET` | `/invoices` | seller scope, newest first |
| `POST` | `/invoices` | create |
| `GET` | `/invoices/:id` | **public** (no auth) — buyer opens share link; embeds `seller.business_name` |
| `POST` | `/invoices/:id/cancel` | only from `pending` → else `409 {code:"INVALID_TRANSITION"}` |

`POST /invoices` request:

```json
{
  "code": "INV-89D517",
  "items": [{ "product_id": "uuid", "quantity": 2 }],
  "customer_name": "Ada Lovelace",
  "customer_contact": "ada@example.com",
  "note": "Optional note"
}
```

Response `201` / public GET response `200` (one object):

```json
{
  "id": "INV-89D517",
  "seller_id": "uuid",
  "items": [
    { "product_id": "uuid", "name": "Air Max 90", "image_url": "", "quantity": 2, "unit_price_kobo": 2700000 }
  ],
  "product_kobo": 5400000,
  "total_kobo": 5400000,
  "customer": { "name": "Ada Lovelace", "contact": "ada@example.com" },
  "note": "",
  "status": "pending",
  "order_id": null,
  "created_at": "2026-09-27T10:00:00.000Z",
  "paid_at": null
}
```

Public GET adds `"seller": { "business_name": "Kicks by Ada" }`.

**Validation**

- `code` optional; if present must match `^INV-[0-9A-F]{6}$` and be unique, otherwise regenerate
  server-side (the form generates one client-side as a display default).
- ≥1 item; each `quantity` integer ≥1; no duplicate `product_id` → `400`
- unknown product → `404`; `quantity > stock` → `409 {code:"OUT_OF_STOCK"}` naming the product
- `customer_name` non-empty

**Payment flow (critical):** when the buyer completes payment for an invoice, the invoice must
become `status:"paid"`, `paid_at` set, `order_id` set, stock decremented per item, and an order
born with `status:"PendingPayment"→"Paid"` snapshots (product/dispatch/total from the invoice at
creation time). Seller then sees it in the normal orders list. Paying a `cancelled` or already
`paid` invoice → `409`.

### 1.2 `DELETE /api/v1/products/:id`

Missing entirely (route currently exposes GET+PATCH only). The inventory page's delete button gets `405`.
**We are adding this handler ourselves in this repo** — please keep it when merging:

- seller auth + ownership (mirror the PATCH handler's checks), `404` unknown, `200 {ok:true}`
- `409 {code:"PRODUCT_HAS_ORDERS"}` if any order references the product (don't cascade-delete paid history)

### 1.3 Smaller asks

| # | Ask | Detail |
|---|---|---|
| 1 | `GET /api/v1/health` is fine | no change — listed for completeness |
| 2 | Buyer OTP `dev_code` | mock/demo returns `dev_code` (card banner only, no toast); live sends real email via SMTP + nodemailer — **deployed env needs `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set or live OTP returns 500** |
| 3 | `GET /sellers/:id` | exists ✓ — FE has no consumer yet (storefront page planned) |

---

## 2. Response-shape adjustments requested

The frontend normalizes these client-side today (column "FE workaround"), but fixing them
server-side lets us delete the adapters. **No blocker** — listed by priority.

| # | Endpoint | Today (v1) | Needed | FE workaround (shipped) | Priority |
|---|---|---|---|---|---|
| R1 | `GET /orders` | no `buyer_email`, no `created_at`, no `payout`, camel status, `updatedAt` | add `buyer_email`, `created_at`, embedded `payout:{status}`; provide display status (see D1) | mapper rebuilds `amounts.*` (missing entirely), renames `updatedAt`, drops buyer column → renders "—" | high |
| R2 | `POST /orders/:id/ship`, `PATCH .../tracking` | return `{id,status}` / `{id,tracking_status}` | return the **full updated order** (same object as `GET /orders/:id`) | refetch `GET /orders/:id` after every mutation (extra round-trip) | medium |
| R3 | `GET /orders/:id` | `events[].from/to` are camel statuses | display statuses (D1) or add `display_status` per event | mapper rewrites every event `from`/`to` + top-level status | high |
| R4 | `GET /orders/:id` | embedded `payout.status` ∈ `none\|pending\|partial\|paid` — disputed orders read `pending` | disputed → `frozen` on the embedded object (as `/orders/:id/payout` reports) | mapper derives `frozen` from `status === "Disputed"` | medium |
| R5 | `GET /auth/me` | `{profile:{businessName,...}, reserved_account:{...}}`, no `created_at` | top-level `reserved_account` (FE destructures it for the payout line — currently **silently disappears**), `profile.business_name`, `profile.created_at` | mapper flattens + renames | high |
| R6 | `GET /sellers/me/dashboard` | keys identical ✓, but `counts_by_status` uses camel statuses | display statuses (D1) | mapper renames the 2 camel keys | high |
| R7 | `GET /products` | **unauthenticated**, returns **all sellers' products** | require seller auth + scope to the token's seller (or `?seller_id=` only when explicitly passed) — today any visitor lists every tenant's inventory | mapper filters client-side by current seller id — data still exposed over the wire | **security** |
| R8 | `GET /products` | returns `seller`, `updatedAt`, `sellerId` (unused) | harmless — keep or drop | — | low |

**D1 — status vocabulary.** The FE (and its seeded demo data) uses display statuses:
`"Pending Payment"`, `"Awaiting Shipment"`, `"Paid"`, `"Shipped"`, `"Delivered"`, `"Completed"`,
`"Disputed"`, `"Cancelled"`. v1 uses `PendingPayment`, `AwaitingShipment`, … anywhere statuses
appear (top-level, `counts_by_status`, `events[].from/to`, `?status=` filter).
**Recommendation:** keep DB enums camel, add `display_status` (and `display_status` per event)
OR standardize on the spaced form in responses. FE ships a `STATUS_DISPLAY` map meanwhile (§4/D1).

---

## 3. Validation relaxations requested

| # | Endpoint | Rule today | Problem | Ask |
|---|---|---|---|---|
| V1 | `POST/PATCH /products` | `dispatchFeeKobo` int ≥0 **required**, `deliveryDays` int ≥1 **required** | Product form no longer collects these — **platform calculates them** (product decision, see decision-log D7) | make both optional, default `0`/`1`; FE currently sends silent defaults `dispatchFeeKobo:0, deliveryDays:1` |
| V2 | `POST /products` | `imageUrl` must be a valid URL if present | FE sends `""` for "no image" | accept `""` (treat as null) |
| V3 | `POST/PATCH /products` | `description` ≥10 chars, **required** on create | form treats it as optional | make optional (default `""`) or FE pads — we pad today; deleting the padding when this lands is trivial |
| V4 | `PATCH /products` | zod strips unknown keys — FE's snake_case payload (`price_kobo`, `stock_quantity`, `image_url`) is **silently ignored** | silent data loss if adapters regress | accept snake_case aliases (or both) |
| V5 | `POST /auth/seller/register` | `bvn` (11 digits), `settlement.{bankCode,accountNumber}` required | **FE now collects these** in live mode ✓ — listed so nobody removes them; sandbox bank validation stays |
| V6 | `POST .../tracking` | backward step → `400 VALIDATION` | mock returns `409` | align to `409 INVALID_TRANSITION` (FE maps both, cosmetic) |
| V7 | OTP verify | code must be exactly `^\d{6}$` | FE now enforces digits via segmented OTP input ✓ | keep |

Accepted differences (no action): rate limits (FE handles 429s with toasts), bcrypt vs demo
hashing, 15-min access JWT (FE relies on refresh cookie being valid for same-origin `/api/v1` —
see §4/W5), `carrier` accepted-but-discarded on ship.

---

## 4. Client-side workarounds we shipped (so you know where behavior lives)

| ID | Workaround | Where |
|---|---|---|
| W1 | `STATUS_DISPLAY` map: camel → spaced statuses, applied to order status, events, dashboard count keys | `lib/api/v1-client.ts` |
| W2 | Order list mapper rebuilds `amounts:{product,dispatch,total}_kobo` from `productPriceKobo` + `dispatchFeeKobo`, renames `updatedAt`, injects `payout`/`buyer_email` defaults | same |
| W3 | Refetch-after-mutation for ship/tracking (R2) | same |
| W4 | Product create/patch sends `dispatchFeeKobo:0`, `deliveryDays:1`, `imageUrl` `""→undefined`, description padded to ≥10 chars (remove when V1–V3 land); list filtered by current seller (R7) | same |
| W5 | Auth: token in `localStorage`; `/auth/me` flattened per R5; register posts camelCase + `bvn` + `settlement` | `lib/api/v1-client.ts`, `app/(auth)/register/page.tsx` |
| W6 | Product DELETE: FE uses mock route when in mock mode; our `DELETE /api/v1/products/:id` added to this repo (§1.2) | `app/api/v1/products/[id]/route.ts` |
| W7 | Local dev switches data source at runtime (toggle on sign-in + navbar). Live mode calls `/api/v1` (proxied to the deployed instance via `API_PROXY_TARGET` locally) | `lib/api/source.ts`, `lib/api/index.ts` |

---

## 5. Parity matrix (living checklist)

Legend: ✅ exists & wired · ⚠️ exists with gaps (item id) · ❌ missing · — n/a (no FE consumer yet)

| Capability | FE consumer | mock API | v1 API | Notes |
|---|---|---|---|---|
| Seller register | ✓ | ✅ | ⚠️ V5 | FE sends bvn/settlement in live mode |
| Seller login | ✓ | ✅ | ✅ | |
| OTP request/verify | ✓ | ✅ (`dev_code` + card banner) | ✅ live sends SMTP email (nodemailer) — `SMTP_*` env required | |
| `GET /auth/me` | ✓ | ✅ | ⚠️ R5 | |
| Dashboard | ✓ | ✅ | ⚠️ R6 | |
| Orders list | ✓ | ✅ | ⚠️ R1 | |
| Order detail | ✓ | ✅ | ⚠️ R3, R4 | |
| Ship / tracking | ✓ | ✅ | ⚠️ R2, V6 | |
| Orders: cancel / confirm-delivery / report-issue / verify / payout / create | — | ✅ (parity pass) | ✅ | buyer UI pending |
| Products list | ✓ | ✅ | ⚠️ R7, R8 | |
| Products create/patch | ✓ | ✅ | ⚠️ V1–V4 | |
| Products **delete** | ✓ | ✅ | ✅ §1.2 (handler shipped in this repo) | returns `409 PRODUCT_HAS_ORDERS` when referenced |
| **Invoices** list/create/detail/cancel/public | ✓ | ✅ | ❌ §1.1 | **top priority** |
| Seller public profile + reputation | — | ✅ (parity pass) | ✅ | storefront page planned |
| Order assistant | — | ✅ (stub, canned reply) | ✅ | FE UI planned |
| Auth refresh | — | ✅ (parity pass) | ✅ | FE uses cookie flow |
| Health | — | ✅ (parity pass) | ✅ | |
| Monnify webhook/simulate | — | — | ✅ | external |

**Mock-only features the FE depends on** (must not regress when v1 gains them): invoice share
links, display-status vocabulary, `frozen` payout status, buyer email on orders, top-level
`reserved_account` on `/auth/me`, snake_case product fields, demo auto-seeding of orders/products.

---

## 6. Open questions for BE

1. Invoice payment rail: reuse the existing Monnify order flow (invoice → pay → order) or a
   dedicated invoice checkout? §1.1 assumes invoice payment **produces a normal order**.
2. Split payout on invoice payment — same beneficiary logic as orders (decision-log D6 env vars)?
3. Should `GET /products` stay public for a future storefront (authenticated by nothing), or is
   seller-scoping fine? (R7 assumes seller-scoped; public browse would need `?seller_id=` + no auth.)
