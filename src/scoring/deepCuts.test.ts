import { describe, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../bandcamp';
import {
  deepCutCandidates,
  deepCutCeiling,
  deepCutReason,
  rankDeepCuts,
  scoreDeepCut,
  type DeepCutFacts,
} from './deepCuts';
import { rankForYou, scoreForYou, twinOwnership, type TwinMatches } from './forYou';
import { nichePenalty } from './weights';

// The research doc's dataset: five twins, none of these releases yours.
const list = (...keys: ItemKey[]) => Float64Array.from(keys.map(keyToNumber)).sort();
const STAPLE: ItemKey = 'a1';
const NICHE: ItemKey = 'a2';
const MID: ItemKey = 'a3';
const HIT: ItemKey = 'a4';
const LONE: ItemKey = 'a5';
const NO_COUNT: ItemKey = 'a6';

const lists = [
  list(STAPLE, MID, HIT), // A
  list(STAPLE, MID, HIT), // B
  list(STAPLE, NICHE, HIT), // C
  list(STAPLE, NICHE, HIT, NO_COUNT), // D
  list(STAPLE, HIT, LONE), // E
];
const twins: TwinMatches[] = [0.6, 0.5, 0.4, 0.3, 0.2].map((score, i) => ({
  score,
  matches: lists[i] as Float64Array,
}));
const owners = new Map<ItemKey, number | null>([
  [STAPLE, 40],
  [NICHE, 3],
  [MID, 25],
  [HIT, 2000],
  [LONE, 1],
  [NO_COUNT, null],
]);
const facts = (id: number): DeepCutFacts | undefined => {
  const key = [...owners.keys()].find((k) => keyToNumber(k) === id);
  return key === undefined
    ? undefined
    : { supporterCount: owners.get(key) ?? null, compilation: false };
};
const owned = twinOwnership(twins, new Set());
const CAP = { maxSupporters: 50, limit: 60 };
const ids = (rows: readonly { id: number }[]) => rows.map((row) => row.id);

describe('nichePenalty', () => {
  it('is n^−0.6, and 1 for a release one fan owns', () => {
    expect(nichePenalty(1)).toBe(1);
    expect(nichePenalty(3)).toBeCloseTo(0.517, 3);
    expect(nichePenalty(1000)).toBeCloseTo(0.016, 3);
  });
});

describe('Deep cuts on the synthetic set', () => {
  it('ranks niche above staple, while For you ranks staple first', () => {
    const deep = rankDeepCuts(owned, facts, CAP);
    expect(ids(deep)).toEqual([NICHE, STAPLE, MID, LONE].map(keyToNumber));
    expect(deep.map((row) => row.score)).toEqual([
      expect.closeTo(0.181, 3),
      expect.closeTo(0.156, 3),
      expect.closeTo(0.08, 3),
      expect.closeTo(0.067, 3),
    ]);

    const forYou = rankForYou(
      owned.flatMap((c) => {
        const count = facts(c.id)?.supporterCount;
        return count == null ? [] : [scoreForYou(c, count)];
      }),
      60,
    );
    expect(ids(forYou).slice(0, 2)).toEqual([STAPLE, NICHE].map(keyToNumber));
  });

  it('leaves out releases over the cap; uncapped, a hit still comes last', () => {
    expect(ids(rankDeepCuts(owned, facts, CAP))).not.toContain(keyToNumber(HIT));

    const uncapped = rankDeepCuts(owned, facts, { maxSupporters: Infinity, limit: 60 });
    expect(uncapped.at(-1)?.id).toBe(keyToNumber(HIT));
    expect(uncapped.at(-1)?.score).toBeCloseTo(0.015, 3);
  });

  it('keeps one weak twin on a 1-owner record below staple and below two twins (mid)', () => {
    const order = ids(rankDeepCuts(owned, facts, CAP));
    const at = (key: ItemKey) => order.indexOf(keyToNumber(key));
    expect(at(LONE)).toBeGreaterThan(at(STAPLE));
    expect(at(LONE)).toBeGreaterThan(at(MID));
    // c is the knob: with no shrink, the lone twin's oddity jumps above mid.
    const unshrunk = ids(rankDeepCuts(owned, facts, { ...CAP, agreement: 0 }));
    expect(unshrunk.indexOf(keyToNumber(LONE))).toBeLessThan(unshrunk.indexOf(keyToNumber(MID)));
  });

  it('skips a release with no Bandcamp count rather than scoring it on local owners', () => {
    const candidate = owned.find((c) => c.id === keyToNumber(NO_COUNT));
    expect(candidate).toBeDefined();
    if (candidate) expect(scoreDeepCut(candidate, null, CAP)).toBeNull();
    expect(ids(rankDeepCuts(owned, facts, CAP))).not.toContain(keyToNumber(NO_COUNT));
  });

  it('takes β and c overrides', () => {
    const niche = owned.find((c) => c.id === keyToNumber(NICHE));
    if (!niche) throw new Error('niche missing');
    expect(scoreDeepCut(niche, 3, { ...CAP, beta: 0, agreement: 0 })?.score).toBeCloseTo(0.7);
  });

  it('halves a compilation', () => {
    const comp = (id: number) => {
      const f = facts(id);
      return f && { ...f, compilation: id === keyToNumber(NICHE) };
    };
    const niche = rankDeepCuts(owned, comp, CAP).find((row) => row.id === keyToNumber(NICHE));
    expect(niche?.score).toBeCloseTo(0.0905, 3);
  });
});

describe('Deep-cut pruning', () => {
  it('never scores above the ceiling T × t/(t + c)', () => {
    for (const candidate of owned) {
      const count = facts(candidate.id)?.supporterCount ?? null;
      for (const agreement of [0, 1, 2, 4]) {
        for (const beta of [0.3, 0.6, 0.8]) {
          const scored = scoreDeepCut(candidate, count, {
            maxSupporters: Infinity,
            beta,
            agreement,
          });
          if (scored) {
            expect(scored.score).toBeLessThanOrEqual(deepCutCeiling(candidate, agreement));
          }
        }
      }
    }
  });

  it('orders candidates by ceiling', () => {
    const ceilings = deepCutCandidates(owned).map((c) => c.ceiling);
    expect(ceilings).toEqual([...ceilings].sort((a, b) => b - a));
  });

  it('never looks up a candidate whose ceiling is below the last ranked score', () => {
    // 60 releases one strong twin and many fans own, then one whose ceiling can't reach them.
    const strong = Float64Array.from({ length: 60 }, (_, i) => i + 100);
    const weak = new Float64Array([1]);
    const candidates = twinOwnership(
      [
        { score: 1, matches: strong },
        { score: 1, matches: strong },
        { score: 0.01, matches: weak },
      ],
      new Set(),
    );
    const looked: number[] = [];
    const ranked = rankDeepCuts(
      candidates,
      (id) => {
        looked.push(id);
        return { supporterCount: 2, compilation: false };
      },
      { maxSupporters: 50, limit: 60 },
    );
    expect(ranked).toHaveLength(60);
    expect(looked).not.toContain(1);
  });
});

describe('deepCutReason', () => {
  it('gives supporters, twins and the best twin rank', () => {
    const niche = rankDeepCuts(owned, facts, CAP).find((row) => row.id === keyToNumber(NICHE));
    if (!niche) throw new Error('niche missing');
    expect(deepCutReason(niche, lists)).toEqual({ supporters: 3, twins: 2, bestTwinRank: 3 });
  });

  it('keeps leaderboard ranks when a twin has no list', () => {
    const niche = { id: keyToNumber(NICHE), supporters: 3, twins: 2 };
    expect(deepCutReason(niche, [undefined, ...lists.slice(1)]).bestTwinRank).toBe(3);
    expect(deepCutReason(niche, []).bestTwinRank).toBeNull();
  });
});
