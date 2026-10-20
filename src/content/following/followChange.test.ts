import { describe, expect, it } from 'vitest';
import { followChange } from './followChange';

describe('followChange', () => {
  it('reads Bandcamp toggling `following` on a follow button', () => {
    expect(followChange('follow-unfollow following', 'follow-unfollow')).toBe('unfollowed');
    expect(followChange('follow-unfollow', 'follow-unfollow following')).toBe('followed');
  });

  it('ignores other class changes', () => {
    expect(followChange('follow-unfollow following', 'follow-unfollow following busy')).toBeNull();
    expect(followChange('follow-unfollow', 'follow-unfollow following-msg')).toBeNull();
    expect(followChange(null, 'follow-unfollow')).toBeNull();
  });
});
