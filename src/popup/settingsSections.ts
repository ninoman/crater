// What the Settings tab shows, in plain words. The raw settings live in shared/settings.ts.

import type { BooleanSetting, NumericSetting } from '../shared/settings';

export type SettingEntry =
  | { kind: 'number'; key: NumericSetting; label: string; description: string }
  | { kind: 'toggle'; key: BooleanSetting; label: string; description: string }
  /** Pace and daily budget as one Gentle / Normal / Fast choice. */
  | { kind: 'speed' }
  /** Lately re-reads on or off; the count and interval are in Advanced. */
  | { kind: 'lately-rescan' };

export interface SettingSection {
  title: string;
  entries: SettingEntry[];
}

export const MAIN_SECTIONS: SettingSection[] = [
  {
    title: 'Scanning',
    entries: [
      { kind: 'speed' },
      {
        kind: 'toggle',
        key: 'seedFromCollection',
        label: 'Discover fans through music you own',
        description: 'After syncing your collection, also look at who else bought those releases.',
      },
    ],
  },
  {
    title: 'Recommendations',
    entries: [
      {
        kind: 'toggle',
        key: 'ignoreCompilations',
        label: 'Skip compilations',
        description:
          "Various-artists comps say little about taste, so they don't count towards crate mates.",
      },
      {
        kind: 'toggle',
        key: 'labelClusterDownweight',
        label: "Don't let one label crowd your crate mates",
        description: 'Fans who mostly buy from one label count for less.',
      },
      {
        kind: 'toggle',
        key: 'followingBoost',
        label: 'Favour artists and labels you follow',
        description: 'Their releases rank a little higher in your picks.',
      },
      { kind: 'lately-rescan' },
      {
        kind: 'number',
        key: 'deepCutMaxSupporters',
        label: 'Deep cuts: fewer owners than',
        description: 'A release counts as a deep cut when fewer fans own it on Bandcamp.',
      },
    ],
  },
  {
    title: 'On Bandcamp pages',
    entries: [
      {
        kind: 'toggle',
        key: 'pageBadges',
        label: 'Show badges next to releases',
        description:
          'Mark releases you own or wishlisted, and how many of your crate mates bought them.',
      },
      {
        kind: 'toggle',
        key: 'tagPrompt',
        label: 'Ask for tags when you wishlist',
        description: 'Opens the tag picker next to Bandcamp’s heart.',
      },
    ],
  },
];

export const ADVANCED_SECTIONS: SettingSection[] = [
  {
    title: 'Scan speed in detail',
    entries: [
      {
        kind: 'number',
        key: 'paceMinMs',
        label: 'Shortest wait (ms)',
        description: 'Dighead waits a random time between these two before each request.',
      },
      {
        kind: 'number',
        key: 'paceMaxMs',
        label: 'Longest wait (ms)',
        description: 'The upper end of that wait.',
      },
      {
        kind: 'number',
        key: 'dailyRequestBudget',
        label: 'Requests per day',
        description: 'Scanning pauses until tomorrow once it gets here.',
      },
    ],
  },
  {
    title: 'How much to read',
    entries: [
      {
        kind: 'number',
        key: 'collectionCap',
        label: 'Purchases per fan',
        description: 'Newest first. Bigger collections are cut off here.',
      },
      {
        kind: 'number',
        key: 'collectionBatchSize',
        label: 'Purchases per request',
        description: 'Bigger pages mean fewer, slower requests.',
      },
      {
        kind: 'number',
        key: 'supportersPerReleaseCap',
        label: 'Fans per release',
        description: 'Newest supporters first, for each release Dighead looks at.',
      },
    ],
  },
  {
    title: 'Crate mates',
    entries: [
      {
        kind: 'number',
        key: 'minCollectionSize',
        label: 'Smallest collection',
        description: 'Fans who own fewer releases are too small a sample to be a crate mate.',
      },
      {
        kind: 'number',
        key: 'maxCollectionSize',
        label: 'Largest collection',
        description: 'Fans who own more, such as shops and archivists, are left out.',
      },
      {
        kind: 'number',
        key: 'topCrateMatesK',
        label: 'Crate mates behind your picks',
        description: 'How many of your closest crate mates shape For you and the page badges.',
      },
      {
        kind: 'number',
        key: 'latelyHalfLifeMonths',
        label: 'Lately: fade after (months)',
        description: 'For Lately crate mates, a purchase counts half as much after this long.',
      },
      {
        kind: 'number',
        key: 'latelyMinPurchases',
        label: 'Lately: fewest recent buys',
        description: 'Fans who bought less than this recently get no Lately match.',
      },
    ],
  },
  {
    title: 'Keeping up with Lately crate mates',
    entries: [
      {
        kind: 'number',
        key: 'latelyRescanCrateMates',
        label: 'Crate mates to re-check',
        description:
          'Your top Lately crate mates, whose newest buys are re-read more often. 0 turns it off.',
      },
      {
        kind: 'number',
        key: 'latelyRescanDays',
        label: 'Re-check every (days)',
        description: 'Everyone else is re-read every 30 days.',
      },
    ],
  },
];

/** Every number in Advanced, so an error there can open the section. */
export const ADVANCED_KEYS: ReadonlySet<NumericSetting> = new Set(
  ADVANCED_SECTIONS.flatMap((section) =>
    section.entries.flatMap((entry) => (entry.kind === 'number' ? [entry.key] : [])),
  ),
);
