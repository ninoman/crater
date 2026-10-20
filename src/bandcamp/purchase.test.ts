import { describe, expect, it } from 'vitest';
import { isPurchaseConfirmationUrl } from './purchase';

const match = (href: string) => isPurchaseConfirmationUrl(new URL(href));

describe('isPurchaseConfirmationUrl', () => {
  it('matches the post-checkout download page, with or without `from`', () => {
    expect(match('https://bandcamp.com/download?cart_id=158574905&sig=x&from=checkout')).toBe(true);
    expect(match('https://bandcamp.com/download?cart_id=158574905&sig=x')).toBe(true);
  });

  it('ignores re-downloads from your collection', () => {
    expect(
      match('https://bandcamp.com/download?from=collection&payment_id=1&sig=x&sitem_id=405660437'),
    ).toBe(false);
  });

  it('ignores other pages', () => {
    expect(match('https://bandcamp.com/digger')).toBe(false);
    expect(match('https://artist.bandcamp.com/download?cart_id=1')).toBe(false);
  });
});
