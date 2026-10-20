import type { AlsoBoughtReason } from '../../shared/alsoBought';

/** The reason line under a recommendation, e.g. "7 of 48 supporters own this". */
export function formatReason(reason: AlsoBoughtReason): string {
  switch (reason.kind) {
    case 'co-owned':
      return `${reason.owners} of ${reason.of} supporters own this`;
    case 'same-artist':
      return 'More from this artist';
    case 'same-label':
      return reason.label ? `Also on ${reason.label}` : 'From the same label';
  }
}

export function formatOwnedTracks(count: number): string {
  return `you own ${count} track${count === 1 ? '' : 's'}`;
}
