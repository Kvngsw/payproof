# PayProof — Roadmap

Ordered by evidence. "Survey" = the 26-person field research ([RESEARCH.md](RESEARCH.md)).

## Next (trust gaps the survey exposed)

| # | Item | Why | Notes |
|---|---|---|---|
| 1 | **Auto-refund SLA timer** | 14/19 buyers named instant refund on non-shipment as the decisive feature | If the seller hasn't moved a paid order to `Shipped` in X days: auto-cancel and refund in full |
| 2 | **Doorstep release code** | 15/19 want to inspect at handoff | Buyer gets a 4-digit code, gives it to the rider only after inspecting; submission releases funds |
| 3 | Auto-release timer | Buyers who never confirm leave sellers unpaid | Release after a grace period unless disputed |
| 4 | Dispute resolution flow | `Disputed` is terminal and payout stays frozen | Evidence upload, arbitration, partial refund |

## Growth features

### Seller CRM and business analytics
Sellers track income and growth from their own order data.

- Income over time (daily / weekly / monthly), settled vs pending vs frozen.
- Growth trend: orders, revenue, completion rate, dispute rate.
- Top products, stock velocity, average order value.
- Customer CRM: every buyer with order history, lifetime value, repeat-purchase flag, notes, and one-tap follow-up or re-order invoice.
- Reputation drivers: what moved the badge, and why.

### Buyer spending insights
Buyers track spending habits and their preferred merchants.

- Spend by week / month / category.
- Merchants they reorder from, ranked, with each merchant's live reputation.
- Order history with payout and dispute outcomes; saved merchants and one-tap reorder.

Both build on data PayProof already holds (orders, events, payouts), so they need aggregation queries and dashboards, not new collection.

## Integrations and money

| Item | Notes |
|---|---|
| Courier API | Shipbubble first (only candidate with a self-serve sandbox, decision D18). Flip `tracking.source` to `courier_api`; manual stays as fallback |
| Real logistics recipient | Replace the sandbox proxy with a contracted dispatch partner |
| Platform fee | Survey: 63% of buyers expect the seller to bear the escrow fee. Proposed seller-side deduction from payout (e.g. 1.5%) |
| Licensed custody | Real escrow needs a regulated settlement partner before any live funds |
| Multi-item carts | Lift the one-item-one-unit limit |
| Cancel-reason tracking | So buyer abandonment doesn't penalise sellers' reputation |
