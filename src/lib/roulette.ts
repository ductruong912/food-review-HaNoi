import type { Restaurant } from './types';

export function getNonRepeatingWheelPool(pool: Restaurant[], recentIds: string[]): Restaurant[] {
  const fresh = pool.filter((restaurant) => !recentIds.includes(restaurant.id));
  return fresh.length ? fresh : pool;
}

export function recordWheelWinner(recentIds: string[], winnerId: string, candidateCount: number): string[] {
  const next = [...new Set([...recentIds, winnerId])];
  return candidateCount > 0 && next.length >= candidateCount ? [winnerId] : next;
}
