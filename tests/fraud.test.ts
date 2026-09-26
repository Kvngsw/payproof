import { describe, it, expect } from 'vitest';
import { evaluateFraud } from '../lib/order-service';

describe('evaluateFraud', () => {
  it('insufficient_history with fewer than 3 completed orders', () => {
    expect(evaluateFraud(5000000, [])).toMatchObject({ triggered: false, state: 'insufficient_history' });
    expect(evaluateFraud(5000000, [4000000, 4500000])).toMatchObject({ triggered: false, state: 'insufficient_history' });
  });

  it('clear when within 50% of the average', () => {

    expect(evaluateFraud(5000000, [4000000, 4500000, 5000000])).toMatchObject({ triggered: false, state: 'clear' });
  });

  it('flags orders >50% above the average', () => {

    expect(evaluateFraud(7000000, [4000000, 4000000, 4000000])).toMatchObject({ triggered: true, state: 'flagged' });
  });

  it('flags orders >50% below the average', () => {

    expect(evaluateFraud(1000000, [4000000, 4000000, 4000000])).toMatchObject({ triggered: true, state: 'flagged' });
  });

  it('boundary: exactly 50% deviation does not flag', () => {

    expect(evaluateFraud(6000000, [4000000, 4000000, 4000000]).triggered).toBe(false);
  });

  it('always labelled Rule-based, never AI', () => {
    expect(evaluateFraud(99999999, [100, 100, 100]).label).toBe('Rule-based');
  });
});
