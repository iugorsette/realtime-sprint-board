import { describe, expect, it } from 'vitest';
import { calculateMidpointPosition, comparePositions, needsRebalancing, rebalancePositions } from './ordering';

describe('fractional card ordering', () => {
  it('handles an empty column and both edges', () => {
    expect(calculateMidpointPosition()).toBe(1024);
    expect(calculateMidpointPosition(undefined, 1024)).toBe(0);
    expect(calculateMidpointPosition(1024)).toBe(2048);
    expect(needsRebalancing()).toBe(false);
  });

  it('interpolates between neighbors and detects unstable positions', () => {
    expect(calculateMidpointPosition(1024, 2048)).toBe(1536);
    expect(needsRebalancing(1024, 2048)).toBe(false);
    expect(needsRebalancing(1024, 1024.0000001)).toBe(true);
    expect(needsRebalancing(2 ** 63)).toBe(true);
    expect(needsRebalancing(undefined, -(2 ** 63))).toBe(true);
    expect(needsRebalancing(1000, 999)).toBe(true);
  });

  it('assigns deterministic positions and sorts ties by ID', () => {
    const ordered = [{ id: 'c', position: 2 }, { id: 'b', position: 1 }, { id: 'a', position: 1 }]
      .sort(comparePositions);
    expect(rebalancePositions(ordered)).toEqual([
      { id: 'a', position: 1024 }, { id: 'b', position: 2048 }, { id: 'c', position: 3072 },
    ]);
  });
});
