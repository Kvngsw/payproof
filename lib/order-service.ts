import db     from './db';
import type { Prisma } from '@prisma/client';
import { logger } from './logger';
import {
  InvalidTransitionError,
  OutOfStockError,
  NotFoundError,
} from './errors';

type DbClient = Prisma.TransactionClient;

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

interface TransitionRule {
  from:   OrderState;
  to:     OrderState;
  actors: Actor[];
}

const TRANSITION_RULES: TransitionRule[] = [

  { from: 'PendingPayment',  to: 'Paid',             actors: ['system'] },
  { from: 'Paid',            to: 'AwaitingShipment',  actors: ['system'] },

  { from: 'AwaitingShipment', to: 'Shipped',          actors: ['seller'] },
  { from: 'Shipped',          to: 'Delivered',         actors: ['seller'] },

  { from: 'Shipped',          to: 'Delivered',         actors: ['buyer']  },
  { from: 'Shipped',          to: 'Disputed',          actors: ['buyer']  },
  { from: 'Delivered',        to: 'Completed',         actors: ['buyer']  },
  { from: 'Delivered',        to: 'Disputed',          actors: ['buyer']  },

  { from: 'PendingPayment',  to: 'Cancelled',          actors: ['buyer', 'system'] },
];

export function canTransition(
  from:  OrderState,
  to:    OrderState,
  actor: Actor,
): boolean {
  return TRANSITION_RULES.some(
    (r) => r.from === from && r.to === to && r.actors.includes(actor),
  );
}

export const TERMINAL_STATES: OrderState[] = ['Completed', 'Cancelled', 'Disputed'];

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

export async function transition(
  orderId: string,
  to:      OrderState,
  actor:   Actor,
  note?:   string,
  client:  DbClient = db,
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

  const result = await client.order.updateMany({
    where: { id: orderId, status: from }, // 0 rows hit = a concurrent request already moved it
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

  await client.orderEvent.create({ // a JSON blob can't answer "all Disputed for seller X"; a table can
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

export async function decrementStock(
  productId: string,
  client:    DbClient = db,
): Promise<void> {
  const result = await client.product.updateMany({
    where: { id: productId, stockQuantity: { gt: 0 } },
    data:  { stockQuantity: { decrement: 1 } },
  });

  if (result.count === 0) {
    throw new OutOfStockError(productId);
  }
}

export async function findOrderByReference(
  reference: string,
  client:    DbClient = db,
) {
  return client.order.findFirst({
    where: {
        payments: { some: { reference } }, // 1.0 matched (sellerId, amount): same-price orders got mispaid
    },
    include: {
      payments: { where: { reference } },
      seller:   { select: { id: true, settlementBank: true, settlementNumber: true, settlementName: true } },
    },
  });
}

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

export function evaluateFraud(totalKobo: number, completedTotals: number[]): FraudResult {
  if (completedTotals.length < 3) { // <3 samples: no average worth comparing against
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

export function splitPayout(
  productKobo:  number,
  dispatchKobo: number,
): { sellerKobo: number; logisticsKobo: number } {
  return {
    sellerKobo:    productKobo, // no platform fee in MVP
    logisticsKobo: dispatchKobo,
  };
}
