import { describe, expect, it } from 'vitest';
import { withFollowed } from './followedText';

describe('withFollowed', () => {
  it('names the account you follow after the reason', () => {
    expect(withFollowed('7 supporters have this so far', 'Warp')).toBe(
      '7 supporters have this so far · you follow Warp',
    );
  });

  it('leaves the reason alone otherwise', () => {
    expect(withFollowed('owned by 5 of your top twins', null)).toBe('owned by 5 of your top twins');
  });
});
