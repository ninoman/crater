import { describe, expect, it } from 'vitest';
import { isPurchaseConfirmationUrl } from './purchase';

describe('isPurchaseConfirmationUrl', () => {
  it('matches the post-checkout download page', () => {
    expect(isPurchaseConfirmationUrl(new URL('https://bandcamp.com/download?cart_id=1'))).toBe(
      true,
    );
  });

  it('ignores other pages', () => {
    expect(isPurchaseConfirmationUrl(new URL('https://bandcamp.com/digger'))).toBe(false);
    expect(isPurchaseConfirmationUrl(new URL('https://artist.bandcamp.com/download'))).toBe(false);
  });
});
