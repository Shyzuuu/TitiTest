export interface Random {
  next(): number;
}

export const mathRandom: Random = { next: () => Math.random() };

/** Générateur déterministe (mulberry32) pour des tests reproductibles. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomBetween(rng: Random, min: number, max: number): number {
  if (max <= min) return min;
  return min + rng.next() * (max - min);
}

export function randomInt(rng: Random, min: number, max: number): number {
  return Math.floor(randomBetween(rng, min, max + 1));
}

export function pick<T>(rng: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() sur une liste vide');
  return items[Math.min(items.length - 1, Math.floor(rng.next() * items.length))] as T;
}
