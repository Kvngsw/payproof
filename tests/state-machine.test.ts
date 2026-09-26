import { describe, it, expect } from 'vitest';
import { canTransition, isTerminal, type OrderState, type Actor } from '../lib/order-service';

const LEGAL: Array<[OrderState, OrderState, Actor]> = [
  ['PendingPayment', 'Paid', 'system'],
  ['Paid', 'AwaitingShipment', 'system'],
  ['AwaitingShipment', 'Shipped', 'seller'],
  ['Shipped', 'Delivered', 'seller'],
  ['Shipped', 'Delivered', 'buyer'],
  ['Shipped', 'Disputed', 'buyer'],
  ['Delivered', 'Completed', 'buyer'],
  ['Delivered', 'Disputed', 'buyer'],
  ['PendingPayment', 'Cancelled', 'buyer'],
  ['PendingPayment', 'Cancelled', 'system'],
];

const ILLEGAL: Array<[OrderState, OrderState, Actor]> = [

  ['PendingPayment', 'Shipped', 'system'],
  ['PendingPayment', 'Completed', 'buyer'],
  ['Paid', 'Shipped', 'seller'],

  ['AwaitingShipment', 'Shipped', 'buyer'],
  ['AwaitingShipment', 'Shipped', 'system'],
  ['Delivered', 'Completed', 'seller'],
  ['Delivered', 'Completed', 'system'],
  ['Shipped', 'Disputed', 'seller'],
  ['PendingPayment', 'Cancelled', 'seller'],

  ['Paid', 'PendingPayment', 'system'],
  ['Completed', 'Disputed', 'buyer'],
  ['Cancelled', 'Paid', 'system'],
  ['Disputed', 'Completed', 'buyer'],
  ['Completed', 'Completed', 'system'],
];

describe('canTransition', () => {
  it.each(LEGAL)('%s → %s by %s is legal', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(true);
  });

  it.each(ILLEGAL)('%s → %s by %s is illegal', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(false);
  });
});

describe('isTerminal', () => {
  it('Completed, Cancelled, Disputed are terminal', () => {
    expect(isTerminal('Completed')).toBe(true);
    expect(isTerminal('Cancelled')).toBe(true);
    expect(isTerminal('Disputed')).toBe(true);
  });

  it('all other states are non-terminal (FE keeps polling)', () => {
    for (const s of ['PendingPayment', 'Paid', 'AwaitingShipment', 'Shipped', 'Delivered'] as OrderState[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });
});
