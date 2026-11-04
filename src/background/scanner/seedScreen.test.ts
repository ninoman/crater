import { describe, expect, it } from 'vitest';
import { FAN_FRESH_MS } from './freshness';
import { profileRulesOut, screenSeedFan } from './seedScreen';

const NOW = 1_800_000_000_000;
const fresh = (inCommon: number | null) => ({ inCommon, profiledAt: NOW - 1000 });
const base = { followed: false, shared: 0, fan: undefined, cutoff: 5, now: NOW };

describe('screenSeedFan', () => {
  it('reads fans already known to share enough, and fans you follow, without a profile', () => {
    expect(screenSeedFan({ ...base, shared: 5 })).toBe('read');
    expect(screenSeedFan({ ...base, followed: true, fan: fresh(0) })).toBe('read');
  });

  it('asks for the profile when there is none, or it is stale or logged out', () => {
    expect(screenSeedFan(base)).toBe('profile');
    expect(screenSeedFan({ ...base, fan: { inCommon: 9, profiledAt: NOW - FAN_FRESH_MS } })).toBe(
      'profile',
    );
    expect(screenSeedFan({ ...base, fan: fresh(null) })).toBe('profile');
  });

  it('decides from a recent profile', () => {
    expect(screenSeedFan({ ...base, fan: fresh(4) })).toBe('skip');
    expect(screenSeedFan({ ...base, fan: fresh(5) })).toBe('read');
  });
});

describe('profileRulesOut', () => {
  it('only rules out on a recent signed-in count below the cut-off', () => {
    expect(profileRulesOut(fresh(4), 5, NOW)).toBe(true);
    expect(profileRulesOut(fresh(5), 5, NOW)).toBe(false);
    expect(profileRulesOut(fresh(null), 5, NOW)).toBe(false);
    expect(profileRulesOut({ inCommon: 0 }, 5, NOW)).toBe(false);
  });
});
