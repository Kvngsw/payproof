/**
 * lib/order-service.ts — Order state machine + optimistic locking.
 *
 * WHY (state machine): The order flow is a finite state machine. Modelling
 * it explicitly as a table of (from, to, actor) triples means every legal
 * and illegal transition is enumerated in one place. Bugs are caught at
 * the transition layer, not scattered across 10 route handlers.
 *
 * WHY (optimistic locking with updateMany):
 *   Instead of SELECT ... FOR UPDATE (pessimistic, holds a DB lock),
 *   we do: UPDATE orders SET state=$new WHERE id=$id AND state=$expected.
 *   If two requests arrive simultaneously, only one succeeds (count=1).
 *   The second sees count=0 and throws. No deadlocks, no lock contention.
 *   This is the same technique proven in PayProof 1.0 — kept and upgraded.
 *
 * WHY (order_events table): 1.0 stored timestamps in a JSON blob. 2.0
 * uses a proper relational table so you can query "all Disputed events
 * for seller X" with a real SQL JOIN, not a JSON scan.
 *
 * Rewritten from PayProof 1.0 lib/orderService.js:
 *   + Added Cancelled and Disputed states (spec §7.4, D3, D5)
 *   + Actor enforcement per transition (seller/buyer/system)
 *   + order_events table replaces timestamps JSON blob
 *   + Fraud rule: >50% deviation from Completed avg (not 5× ratio)
 *   + findByReference() replaces findPendingOrderBySeller() (critical bug fix)
 */

import db     from './db';
import { logger } from './logger';
import {
  InvalidTransitionError,
  OutOfStockError,
  NotFoundError,
} from './errors';

// ── State types ───────────────────────────────────────────────────────────────

export const ORDER_STATES = [
  'PendingPayment',
  'Paid',
  'AwaitingShipment',
  'Shipped',
  'Delivered',
  'Completed',
  'Cancelled',
  'Disputed',
] as const;

export type OrderState = typeof ORDER_STATES[number];
export type Actor      = 'system' | 'seller' | 'buyer';

// ── Transition table (spec §7.4) ──────────────────────────────────────────────
//
// Each entry: [from, to, allowedActors]
// Actor is enforced at the service layer — callers must pass the correct actor.

interface TransitionRule {
  from:   OrderState;
  to:     OrderState;
  actors: Actor[];
}

const TRANSITION_RULES: TransitionRule[] = [
  // System-driven (webhook / verify)
  { from: 'PendingPayment',  to: 'Paid',             actors: ['system'] },
  { from: 'Paid',            to: 'AwaitingShipment',  actors: ['system'] },
  // Seller-driven
  { from: 'AwaitingShipment', to: 'Shipped',          actors: ['seller'] },
  { from: 'Shipped',          to: 'Delivered',         actors: ['seller'] },
  // Buyer-driven
  { from: 'Shipped',          to: 'Delivered',         actors: ['buyer']  },  // via E19 shortcut
  { from: 'Shipped',          to: 'Disputed',          actors: ['buyer']  },
  { from: 'Delivered',        to: 'Completed',         actors: ['buyer']  },
  { from: 'Delivered',        to: 'Disputed',          actors: ['buyer']  },
  // Cancel (buyer or system — only from PendingPayment, D3)
  { from: 'PendingPayment',  to: 'Cancelled',          actors: ['buyer', 'system'] },
];

/**
 * Pure function — no DB side effects. Safe to unit test.
 * Returns true if the transition is allowed for the given actor.
 */
export function canTransition(
  from:  OrderState,
  to:    OrderState,
  actor: Actor,
): boolean {
  return TRANSITION_RULES.some(
    (r) => r.from === from && r.to === to && r.actors.includes(actor),
  );
}

/** Terminal states — polling stops here; no further transitions allowed. */
export const TERMINAL_STATES: OrderState[] = ['Completed', 'Cancelled', 'Disputed'];

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

// ── Transition executor ───────────────────────────────────────────────────────

/**
 * Advance an order to a new state with optimistic locking.
 *
 * @param orderId  - The order to advance.
 * @param to       - The target state.
 * @param actor    - Who is performing the action (system | seller | buyer).
 * @param note     - Optional note stored in order_events.
 * @param client   - Prisma client or transaction client (for atomic operations).
 */
export async function transition(
  orderId: string,
  to:      OrderState,
  actor:   Actor,
  note?:   string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client:  any = db,
): Promise<void> {
  const order = await client.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  });

  if (!order) throw new NotFoundError(`Order ${orderId}`);

  const from = order.status as OrderState;

  if (!canTransition(from, to, actor)) {
    throw new InvalidTransitionError(from, to);
  }

  // Optimistic lock — only update if state still matches what we read.
  // If another request already advanced this order, update hits 0 rows.
  const result = await client.order.updateMany({
    where: { id: orderId, status: from },
    data:  { status: to, updatedAt: new Date() },
  });

  if (result.count === 0) {
    const current = await client.order.findUnique({
      where:  { id: orderId },
      select: { status: true },
    });
    if (!current) throw new NotFoundError(`Order ${orderId}`);
    throw new InvalidTransitionError(current.status, to);
  }

  // Persist the event — the authoritative audit trail.
  await client.orderEvent.create({
    data: {
      orderId,
      fromStatus: from,
      toStatus:   to,
      actor,
      ...(note && { note }),
    },
  });

  logger.info('Order state transitioned', {
    orderId,
    from,
    to,
    actor,
    ...(note && { note }),
  });
}

// ── Stock management ──────────────────────────────────────────────────────────

/**
 * Decrement stock inside a transaction.
 * Guards against going below zero (oversell protection).
 * Throws OutOfStockError if stock = 0 before decrement.
 */
export async function decrementStock(
  productId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client:    any = db,
): Promise<void> {
  const result = await client.product.updateMany({
    where: { id: productId, stockQuantity: { gt: 0 } },
    data:  { stockQuantity: { decrement: 1 } },
  });

  if (result.count === 0) {
    throw new OutOfStockError(productId);
  }
}

// ── Order lookup by payment reference ─────────────────────────────────────────

/**
 * Find a PendingPayment order by its payment reference.
 *
 * WHY: PayProof 1.0 looked up orders by (sellerId, amount) — if a seller
 * had two pending orders at the same price, the wrong one got marked Paid.
 * 2.0 uses the payment reference (echoed back by Monnify in the webhook)
 * to uniquely identify the order. This is the critical bug fix.
 */
export async function findOrderByReference(
  reference: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client:    any = db,
) {
  return client.order.findFirst({
    where: {
      payments: { some: { reference } },
    },
    include: {
      payments: { where: { reference } },
      seller:   { select: { id: true, settlementBank: true, settlementNumber: true, settlementName: true } },
    },
  });
}

// ── Fraud rule ────────────────────────────────────────────────────────────────

/**
 * Rule-based fraud signal.
 *
 * WHY: >50% deviation from the seller's Completed-order average flags the
 * order as suspicious. It's informational only — never blocks payment.
 *
 * Spec §7.8 + D15:
 *   - <3 Completed orders → state: 'insufficient_history'
 *   - triggered = abs(total - avg) / avg > 0.5
 *   - Always labelled "Rule-based" in UI — never called "AI"
 */
export interface FraudResult {
  triggered: boolean;
  state:     'flagged' | 'clear' | 'insufficient_history';
  label:     'Rule-based';
}

export async function runFraudCheck(
  sellerId:   string,
  totalKobo:  number,
): Promise<FraudResult> {
  const completed = await db.order.findMany({
    where:  { sellerId, status: 'Completed' },
    select: { totalKobo: true },
  });

  const result = evaluateFraud(totalKobo, completed.map((o) => o.totalKobo));

  logger.info('Fraud check', { sellerId, totalKobo, ...result });
  return result;
}

/**
 * Pure fraud evaluation — unit tested without a database.
 * >50% deviation from the Completed-order average flags the order.
 * <3 Completed orders → insufficient_history (D15).
 */
export function evaluateFraud(totalKobo: number, completedTotals: number[]): FraudResult {
  if (completedTotals.length < 3) {
    return { triggered: false, state: 'insufficient_history', label: 'Rule-based' };
  }

  const avg = completedTotals.reduce((sum: number, t: number) => sum + t, 0) / completedTotals.length;
  const deviation = Math.abs(totalKobo - avg) / avg;

  return {
    triggered: deviation > 0.5,
    state:     deviation > 0.5 ? 'flagged' : 'clear',
    label:     'Rule-based',
  };
}

// ── Payout split (pure function — unit tested) ────────────────────────────────

/**
 * Split an order's total into seller and logistics components.
 *
 * WHY: The spec (§7.7) requires two separate transfers. The function is
 * pure (no side effects) so it can be unit tested in isolation.
 *
 * Invariant (enforced by test): sellerKobo + logisticsKobo === totalKobo
 * No platform fee in MVP.
 */
export function splitPayout(
  productKobo:  number,
  dispatchKobo: number,
): { sellerKobo: number; logisticsKobo: number } {
  return {
    sellerKobo:    productKobo,
    logisticsKobo: dispatchKobo,
  };
}
