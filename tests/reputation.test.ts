import { describe, it, expect } from 'vitest';
import { computeScore, computeBadge } from '../lib/reputation';

describe('computeScore', () => {
  it('null when no terminal history', () => {
    expect(computeScore(0, 0)).toBeNull();
  });

  it('completed / terminal total', () => {
    expect(computeScore(6, 9)).toBeCloseTo(0.6667, 4);
    expect(computeScore(9, 9)).toBe(1);
    expect(computeScore(0, 3)).toBe(0);
  });
});

describe('computeBadge', () => {
  it('no history yet', () => {
    expect(computeBadge(null, 0)).toBe('No history yet');
  });

  it('thresholds', () => {
    expect(computeBadge(0.97, 10)).toBe('97% completed');
    expect(computeBadge(0.92, 10)).toBe('>90% completed');
    expect(computeBadge(0.85, 10)).toBe('>80% completed');
    expect(computeBadge(0.5, 10)).toBe('50% completed');
  });
});
