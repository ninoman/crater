// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import {
  actionChange,
  FOLLOW_ACTION,
  fanProfileUrl,
  readBandHeader,
  WISHLIST_ACTION,
} from './pageActions';

/** Each section of the fixture as a page of its own, since they repeat Bandcamp's ids. */
function section(id: string): Document {
  const el = new DOMParser()
    .parseFromString(fixtureText('page-actions.html'), 'text/html')
    .getElementById(id);
  if (!el) throw new Error(`no #${id} in page-actions.html`);
  return new DOMParser().parseFromString(el.innerHTML, 'text/html');
}

describe('WISHLIST_ACTION', () => {
  it('reads the heart as Bandcamp flips it', () => {
    const release = section('release');
    expect(WISHLIST_ACTION.isOn(release)).toBe(false);
    // What Bandcamp's collectItem does before its request.
    WISHLIST_ACTION.button(release)?.classList.replace('wishlist', 'wishlisted');
    expect(WISHLIST_ACTION.isOn(release)).toBe(true);
  });

  it('says nothing about an item you own', () => {
    const release = section('release');
    WISHLIST_ACTION.button(release)?.setAttribute('class', 'purchased');
    expect(WISHLIST_ACTION.isOn(release)).toBeNull();
  });

  it('says nothing until Bandcamp renders the heart', () => {
    expect(WISHLIST_ACTION.isOn(section('fan'))).toBeNull();
  });
});

describe('FOLLOW_ACTION', () => {
  it('reads the band follow button on a release page', () => {
    const release = section('release');
    expect(FOLLOW_ACTION.isOn(release)).toBe(false);
    FOLLOW_ACTION.button(release)?.classList.add('following');
    expect(FOLLOW_ACTION.isOn(release)).toBe(true);
  });

  it('reads the fan follow button on a fan page', () => {
    const fan = section('fan');
    expect(FOLLOW_ACTION.button(fan)?.id).toBe('follow-unfollow_5325531');
    expect(FOLLOW_ACTION.isOn(fan)).toBe(false);
  });

  it('counts a mailing-list sign-up as following', () => {
    expect(FOLLOW_ACTION.isOn(section('band-subscribed'))).toBe(true);
  });

  it('reads nothing from the placeholder', () => {
    expect(FOLLOW_ACTION.isOn(section('band-placeholder'))).toBeNull();
  });
});

describe('actionChange', () => {
  it('turns two known states into on or off', () => {
    expect(actionChange(false, true)).toBe('on');
    expect(actionChange(true, false)).toBe('off');
  });

  it('ignores no change and changes from or to unknown', () => {
    expect(actionChange(true, true)).toBeNull();
    expect(actionChange(null, true)).toBeNull();
    expect(actionChange(false, null)).toBeNull();
  });
});

describe('readBandHeader', () => {
  it('reads the name and location', () => {
    expect(readBandHeader(section('release'))).toEqual({ name: 'Floating Points', location: 'UK' });
  });

  it('names the selling account on a release page, not its artist', () => {
    const page = new DOMParser().parseFromString(
      fixtureText('album-page-compilation.html'),
      'text/html',
    );
    // Sold by the label, not "Various Artists".
    expect(readBandHeader(page)?.name).toBe('Jazzman Albums');
  });

  it('is null without the block', () => {
    expect(readBandHeader(section('fan'))).toBeNull();
  });
});

describe('fanProfileUrl', () => {
  it('keeps only the username', () => {
    expect(fanProfileUrl('https://bandcamp.com/jiggypol/wishlist?x=1')).toBe(
      'https://bandcamp.com/jiggypol',
    );
  });
});
