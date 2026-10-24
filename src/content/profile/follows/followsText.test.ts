import { describe, expect, it } from 'vitest';
import {
  formatAccounts,
  formatChecked,
  formatFollowsReason,
  formatFollowsSummary,
  formatWhen,
} from './followsText';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24, 15);

describe('formatWhen', () => {
  it('counts whole days, so a release dated midnight today is today', () => {
    expect(formatWhen(Date.UTC(2026, 9, 24), NOW, false)).toBe('today');
    expect(formatWhen(Date.UTC(2026, 9, 23), NOW, false)).toBe('yesterday');
    expect(formatWhen(Date.UTC(2026, 9, 21), NOW, false)).toBe('3 days ago');
  });

  it('says when a pre-order is out', () => {
    expect(formatWhen(Date.UTC(2026, 9, 29), NOW, true)).toBe('pre-order, out in 5 days');
    expect(formatWhen(Date.UTC(2026, 9, 25), NOW, false)).toBe('out tomorrow');
  });
});

describe('formatFollowsReason', () => {
  it('adds crate-mate interest when there is some', () => {
    expect(
      formatFollowsReason({ newsAt: NOW - 2 * DAY, preorder: false, crateMates: 3 }, NOW),
    ).toBe('2 days ago · 3 of your top crate mates buy from them');
    expect(formatFollowsReason({ newsAt: NOW, preorder: false, crateMates: 1 }, NOW)).toBe(
      'today · one of your top crate mates buys from them',
    );
    expect(formatFollowsReason({ newsAt: NOW, preorder: false, crateMates: 0 }, NOW)).toBe('today');
  });
});

describe('formatAccounts', () => {
  it('names the accounts that are not the artist', () => {
    expect(formatAccounts(['Floating Points'], 'floating points')).toBeNull();
    expect(formatAccounts(['Michael J. Blood', 'Peacefrog Records'], 'Michael J. Blood')).toBe(
      'Peacefrog Records',
    );
    expect(formatAccounts(['Warp', 'Ninja Tune'], 'Artist')).toBe('Warp & Ninja Tune');
  });
});

describe('summary lines', () => {
  it('reads naturally for one and many', () => {
    expect(formatFollowsSummary(1, 1, 60)).toBe(
      '1 release from the artist or label you follow, last 60 days',
    );
    expect(formatFollowsSummary(14, 212, 60)).toBe(
      '14 releases from the 212 artists and labels you follow, last 60 days',
    );
    expect(formatChecked(120, 212)).toBe('Checked 120 of 212 accounts');
  });
});
