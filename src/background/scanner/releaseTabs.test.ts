import { describe, expect, it } from 'vitest';
import { leaveTab } from './releaseTabs';

describe('leaveTab', () => {
  it('returns the release a closed tab showed', () => {
    expect(leaveTab({ 1: 'a1', 2: 'a2' }, 1)).toEqual({ tabs: { 2: 'a2' }, left: 'a1' });
  });

  it('returns nothing while another tab shows the same release', () => {
    expect(leaveTab({ 1: 'a1', 2: 'a1' }, 1)).toEqual({ tabs: { 2: 'a1' }, left: null });
  });

  it('returns nothing for a tab that showed no release', () => {
    expect(leaveTab({ 2: 'a2' }, 1)).toEqual({ tabs: { 2: 'a2' }, left: null });
  });
});
