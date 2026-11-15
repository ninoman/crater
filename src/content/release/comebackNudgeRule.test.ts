import { describe, expect, it } from 'vitest';
import {
  NUDGE_GAP_MS,
  NUDGE_MIN_PICKS,
  type NudgeInput,
  shouldShowComebackNudge,
} from './comebackNudgeRule';

const now = 1_800_000_000_000;
const qualifying: NudgeInput = {
  now,
  collapsedAt: now - NUDGE_GAP_MS,
  lastNudgeAt: null,
  trusted: true,
  picks: NUDGE_MIN_PICKS,
};

describe('shouldShowComebackNudge', () => {
  it('shows once every rule holds, at the exact thresholds', () => {
    expect(shouldShowComebackNudge(qualifying)).toBe(true);
  });

  it('waits until the sidebar has been collapsed for 3 days', () => {
    expect(shouldShowComebackNudge({ ...qualifying, collapsedAt: now - NUDGE_GAP_MS + 1 })).toBe(
      false,
    );
  });

  it('never shows without a collapse time', () => {
    expect(shouldShowComebackNudge({ ...qualifying, collapsedAt: null })).toBe(false);
  });

  it('skips early picks during the warm-up', () => {
    expect(shouldShowComebackNudge({ ...qualifying, trusted: false })).toBe(false);
  });

  it('needs at least 5 picks', () => {
    expect(shouldShowComebackNudge({ ...qualifying, picks: NUDGE_MIN_PICKS - 1 })).toBe(false);
  });

  it('keeps a fixed 3-day gap after Not now', () => {
    expect(shouldShowComebackNudge({ ...qualifying, lastNudgeAt: now - NUDGE_GAP_MS + 1 })).toBe(
      false,
    );
    expect(shouldShowComebackNudge({ ...qualifying, lastNudgeAt: now - NUDGE_GAP_MS })).toBe(true);
  });
});
