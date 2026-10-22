import { describe, expect, it } from 'vitest';
import { barVerdict, type AggRow } from './aggregate';
import { rankDeepCuts } from './deepCutsAdapter';
import { buildMethods } from './methods';
import type { Candidate } from './types';

// The research doc's synthetic set: five twins A..E (0.6 .. 0.2).
const cand = (id: number, twinScore: number, twins: number, supporters: number): Candidate => ({
  id,
  twinScore,
  twins,
  supporters,
  owners: twins,
});
const STAPLE = cand(1, 2.0, 5, 40);
const NICHE = cand(2, 0.7, 2, 3);
const MID = cand(3, 1.1, 2, 25);
const HIT = cand(4, 2.0, 5, 2000);
const LONE = cand(5, 0.2, 1, 1);
const all = [STAPLE, NICHE, MID, HIT, LONE];
const ids = (list: readonly Candidate[]) => list.map((c) => c.id);

describe('rankDeepCuts adapter', () => {
  it('puts the niche record over the staple and drops releases over the cap', () => {
    const ranked = rankDeepCuts(all, { cap: 50, beta: 0.6, agreement: 2 }, 10);
    expect(ids(ranked)).not.toContain(HIT.id);
    expect(ids(ranked).indexOf(NICHE.id)).toBeLessThan(ids(ranked).indexOf(STAPLE.id));
  });

  it('skips releases with no Bandcamp count', () => {
    const noCount: Candidate = { ...NICHE, id: 9, supporters: null };
    expect(ids(rankDeepCuts([noCount], { cap: 50, beta: 0.6, agreement: 2 }, 10))).toEqual([]);
  });

  it('shrinks a single twin below agreement', () => {
    const ranked = rankDeepCuts([LONE, MID], { cap: 50, beta: 0.6, agreement: 2 }, 10);
    expect(ids(ranked)).toEqual([MID.id, LONE.id]);
  });
});

describe('buildMethods', () => {
  const methods = buildMethods();

  it('covers the baselines and the full grid', () => {
    const count = (kind: string) => methods.filter((m) => m.kind === kind).length;
    expect(count('popularity')).toBe(1);
    expect(count('forYou')).toBe(1);
    expect(count('edge')).toBe(3);
    expect(count('deepCuts')).toBe(4 * 4 * 3);
  });

  it('ranks popularity by twin score and For you by its own penalty', () => {
    const find = (kind: string) => methods.find((m) => m.kind === kind);
    expect(ids(find('popularity')?.rank(all, 5) ?? [])).toEqual(ids(all));
    // For you's mild log penalty: the hit (2000 owners) falls behind the staple, still above lone.
    const forYou = ids(find('forYou')?.rank(all, 5) ?? []);
    expect(forYou.indexOf(STAPLE.id)).toBeLessThan(forYou.indexOf(HIT.id));
    expect(forYou.indexOf(HIT.id)).toBeLessThan(forYou.indexOf(LONE.id));
  });

  it('keeps Edge to the cap', () => {
    const edge = methods.find((m) => m.kind === 'edge' && m.cap === 25);
    expect(ids(edge?.rank(all, 5) ?? [])).toEqual([NICHE.id, MID.id, LONE.id]);
  });
});

describe('barVerdict', () => {
  const row = (nicheRecall: number, medianHitN: number): AggRow => {
    const stat = (mean: number) => ({ mean, sd: 0, folds: 5 });
    const metrics = {
      recall: stat(0.1),
      nicheRecall: stat(nicheRecall),
      arp: stat(5),
      medianHitN: stat(medianHitN),
      singleTwinShare: stat(0.2),
    };
    return { kind: 'deepCuts', label: 'x', nicheCap: 50, at: { 30: metrics, 100: metrics } };
  };

  it('needs both the niche gain and the lower median hit n', () => {
    expect(barVerdict(row(0.4, 5), row(0.2, 100)).met).toBe(true);
    expect(barVerdict(row(0.29, 5), row(0.2, 100)).met).toBe(false);
    expect(barVerdict(row(0.4, 20), row(0.2, 100)).met).toBe(false);
  });

  it('reports the ratios', () => {
    const v = barVerdict(row(0.3, 5), row(0.2, 100));
    expect(v.nicheGain).toBeCloseTo(1.5);
    expect(v.medianShare).toBeCloseTo(0.05);
  });
});
