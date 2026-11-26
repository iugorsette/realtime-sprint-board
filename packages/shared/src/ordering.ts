export const POSITION_STRIDE = 1024;
export const MIN_POSITION_GAP = 0.000001;

export function calculateMidpointPosition(previous?: number, next?: number): number {
  if (previous === undefined) return next === undefined ? POSITION_STRIDE : next - POSITION_STRIDE;
  if (next === undefined) return previous + POSITION_STRIDE;
  return previous / 2 + next / 2;
}

export function needsRebalancing(previous?: number, next?: number): boolean {
  const midpoint = calculateMidpointPosition(previous, next);
  return !Number.isFinite(midpoint)
    || (previous !== undefined && midpoint <= previous)
    || (next !== undefined && midpoint >= next)
    || (previous !== undefined && next !== undefined && next - previous < MIN_POSITION_GAP);
}

export function rebalancePositions<T extends { id: string }>(items: readonly T[]) {
  return items.map(({ id }, index) => ({ id, position: (index + 1) * POSITION_STRIDE }));
}

export function comparePositions(a: { position: number; id: string }, b: { position: number; id: string }) {
  return a.position - b.position || (a.id < b.id ? -1 : Number(a.id > b.id));
}
