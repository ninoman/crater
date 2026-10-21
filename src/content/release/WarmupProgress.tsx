import type { AlsoBoughtWarmup } from '../../shared/alsoBought';
import { Progress } from '../../ui';
import { formatWarmup, warmupFill } from './warmupText';

export interface WarmupProgressProps {
  warmup: AlsoBoughtWarmup;
  /** A notice above says why the scanner isn't running. */
  scanStopped: boolean;
}

/** Why co-owned picks aren't showing yet, and how close they are. */
export function WarmupProgress({ warmup, scanStopped }: WarmupProgressProps) {
  const fill = warmupFill(warmup);
  return (
    <div className="dh-warmup" role="status">
      <p className="dh-warmup__title">Reading supporters before picking</p>
      <p className="dh-warmup__line">
        {scanStopped
          ? 'The scanner is stopped for now; the notice above says why.'
          : 'Picks appear once enough supporters are read to trust what they share.'}
      </p>
      <Progress value={fill.value} max={fill.max} label="Also-bought warm-up" />
      <p className="dh-warmup__line">{formatWarmup(warmup)}</p>
    </div>
  );
}
