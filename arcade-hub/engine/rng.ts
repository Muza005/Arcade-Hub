// Генератор с сидом (mulberry32). Вся случайность игр и платформы — только отсюда (ARCADE_HUB_SPEC §0 п. 4, §2).

export interface Rng {
  readonly seed: number;
  /** Равномерно в [0, 1). */
  next(): number;
  /** Равномерно в [min, max). */
  range(min: number, max: number): number;
  /** Случайный элемент непустого массива. */
  pick<T>(items: readonly T[]): T;
}

const UINT32 = 0x100000000;

export function createRng(seed: number): Rng {
  const start = seed >>> 0;
  let state = start;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / UINT32;
  };

  return {
    seed: start,
    next,
    range: (min, max) => min + (max - min) * next(),
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
  };
}

/** Новый сид матча. Берётся из криптографического источника, а не из Math.random(). */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}
