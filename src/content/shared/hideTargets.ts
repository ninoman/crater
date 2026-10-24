// A row's hide menu in terms of what the worker hides (decisions §22). Pure.

import type { ItemKey } from '../../bandcamp';
import type { HideScopes, HideTarget } from '../../shared/hide';
import type { HideScope } from '../../ui';

/** The names the menu shows for the wider hides; null leaves that item out. */
export function hideScopeNames(scopes: HideScopes): { band: string | null; label: string | null } {
  return { band: scopes.band?.name ?? null, label: scopes.label?.name ?? null };
}

/** What a picked menu item hides. Null for a scope the row doesn't offer. */
export function hideTargetFor(
  row: { matchKey: ItemKey; hide: HideScopes },
  scope: HideScope,
): HideTarget | null {
  switch (scope) {
    case 'release':
      return { kind: 'release', matchKey: row.matchKey };
    case 'band':
      return row.hide.band;
    case 'label':
      return row.hide.label;
  }
}
