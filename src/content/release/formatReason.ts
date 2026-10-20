import type { AlsoBoughtReason } from '../../shared/alsoBought';

/**
 * The reason line under a recommendation, e.g. "7 of 48 supporters own this", plus how many of
 * them are your twins, since that's what lifted it in the ranking.
 */
export function formatReason(reason: AlsoBoughtReason): string {
  switch (reason.kind) {
    case 'co-owned': {
      const line = `${reason.owners} of ${reason.of} supporters own this`;
      if (reason.twins === 0) return line;
      return `${line}, ${reason.twins === 1 ? '1 is your twin' : `${reason.twins} are your twins`}`;
    }
    case 'same-artist':
      return 'More from this artist';
    case 'same-label':
      return reason.label ? `Also on ${reason.label}` : 'From the same label';
  }
}

export function formatOverlap(count: number): string {
  return `${count} release${count === 1 ? '' : 's'} in common with you`;
}
