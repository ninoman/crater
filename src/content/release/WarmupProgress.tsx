import type { AlsoBoughtWarmup } from '../../shared/alsoBought';
import { Gathering } from './Gathering';
import { formatWarmup } from './warmupText';

export interface WarmupProgressProps {
  warmup: AlsoBoughtWarmup;
  /** Supporters the scan header counts up to, or null before it knows. */
  scanTotal: number | null;
  /** A notice above says why the scanner isn't running. */
  scanStopped: boolean;
  /** Early picks show below, so this heads them instead of placeholders. */
  early: boolean;
}

/** Why trusted picks aren't showing yet, and how close they are. */
export function WarmupProgress({ warmup, scanTotal, scanStopped, early }: WarmupProgressProps) {
  return (
    <Gathering
      title={early ? 'Early picks' : 'Reading supporters before picking'}
      description={
        scanStopped
          ? 'The scanner is stopped for now; the notice above says why.'
          : early
            ? 'From the supporters read so far. They firm up as more are read.'
            : 'Picks appear once enough supporters are read to trust what they share.'
      }
      paused={scanStopped}
      placeholders={!early}
    >
      <p className="dh-warmup__line">{formatWarmup(warmup, scanTotal)}</p>
    </Gathering>
  );
}
