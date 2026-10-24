import { describe, expect, it } from 'vitest';
import type { HideScopes } from '../../shared/hide';
import { hideScopeNames, hideTargetFor } from './hideTargets';

const scopes: HideScopes = {
  band: { kind: 'band', bandId: 5, name: 'Artist' },
  label: { kind: 'label', labelId: 9, name: 'Label' },
};

describe('hide targets', () => {
  it('turns each menu item into what it hides', () => {
    const row = { matchKey: 'a1' as const, hide: scopes };
    expect(hideTargetFor(row, 'release')).toEqual({ kind: 'release', matchKey: 'a1' });
    expect(hideTargetFor(row, 'band')).toEqual(scopes.band);
    expect(hideTargetFor(row, 'label')).toEqual(scopes.label);
  });

  it('offers only the scopes a row knows', () => {
    const row = { matchKey: 'a1' as const, hide: { band: null, label: scopes.label } };
    expect(hideScopeNames(row.hide)).toEqual({ band: null, label: 'Label' });
    expect(hideTargetFor(row, 'band')).toBeNull();
  });
});
