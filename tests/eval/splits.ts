// Which of your releases to hold out. Pure; ids are match ids (keyToNumber).

export interface Purchase {
  id: number;
  /** When you bought it (ms), null when Bandcamp gave no date. */
  at: number | null;
}

/** The newest `fraction` of purchases. Undated ones count as oldest; ties break on id. */
export function temporalHoldout(purchases: readonly Purchase[], fraction: number): number[] {
  const newestFirst = [...purchases].sort((a, b) => (b.at ?? -1) - (a.at ?? -1) || a.id - b.id);
  return newestFirst.slice(0, Math.round(purchases.length * fraction)).map((p) => p.id);
}

/** Share of purchases with a date: a temporal split on mostly undated data would be arbitrary. */
export function datedShare(purchases: readonly Purchase[]): number {
  if (purchases.length === 0) return 0;
  return purchases.filter((p) => p.at !== null).length / purchases.length;
}

/** Deterministic PRNG (mulberry32), so reruns hold out the same releases. */
export function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffles the ids and deals them into `folds` near-equal parts. Every id lands in one. */
export function randomFolds(ids: readonly number[], folds: number, seed: number): number[][] {
  const next = seededRandom(seed);
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as number, shuffled[i] as number];
  }
  const parts: number[][] = Array.from({ length: folds }, () => []);
  for (const [i, id] of shuffled.entries()) parts[i % folds]?.push(id);
  return parts;
}
