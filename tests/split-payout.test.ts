/**
 * tests/split-payout.test.ts — QA-02.
 *
 * Invariant (§7.7): sellerKobo + logisticsKobo === totalKobo for every
 * input. No platform fee in MVP: seller gets exactly productKobo.
 */

import { describe, it, expect } from 'vitest';
import { splitPayout } from '../lib/order-service';

describe('splitPayout invariant', () => {
  const cases: Array<[number, number]> = [
    [4500000, 250000],
    [100, 0],
    [1, 1],
    [999999999, 50000000],
    [0, 250000],
  ];

  it.each(cases)('product=%i dispatch=%i sums exactly', (product, dispatch) => {
    const { sellerKobo, logisticsKobo } = splitPayout(product, dispatch);
    expect(sellerKobo).toBe(product);
    expect(logisticsKobo).toBe(dispatch);
    expect(sellerKobo + logisticsKobo).toBe(product + dispatch);
    expect(Number.isInteger(sellerKobo)).toBe(true);
    expect(Number.isInteger(logisticsKobo)).toBe(true);
  });
});
