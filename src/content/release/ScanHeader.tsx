import type { ScanProgressView } from '../../hooks/useScanProgress';
import type { ScannerStatusView } from '../../hooks/useScannerStatus';
import { clockTime } from '../../shared/timeAgo';
import { Notice, Progress } from '../../ui';

/** Where the supporter scan stands, and whether the queue is paused. */
export function ScanHeader({
  progress,
  scanner,
}: {
  progress: ScanProgressView;
  scanner: ScannerStatusView;
}) {
  const status = scanner.state === 'ready' ? scanner.status : null;
  return (
    <div className="dh-scan-header">
      {status?.pause?.reason === 'backoff' && (
        <Notice tone="warning">
          Queue paused: Bandcamp asked Dighead to slow down. Resumes at{' '}
          {clockTime(status.pause.until)}.
        </Notice>
      )}
      {status?.pause?.reason === 'budget' && (
        <Notice tone="warning">
          Queue paused: today&apos;s request budget is used up. Resumes at midnight.
        </Notice>
      )}
      <ProgressLine progress={progress} />
    </div>
  );
}

function ProgressLine({ progress }: { progress: ScanProgressView }) {
  if (progress.state === 'loading') {
    return <p className="dh-scan-header__line">Checking scan status…</p>;
  }
  if (progress.state === 'unreachable') return null;
  const { scanned, total, listed } = progress.progress;
  if (!listed) return <p className="dh-scan-header__line">Waiting to read the supporter list…</p>;
  if (total === 0) return null;
  if (scanned >= total) {
    return <p className="dh-scan-header__line">All {total} supporters scanned</p>;
  }
  return (
    <>
      <p className="dh-scan-header__line">
        {scanned} / {total} supporters scanned
      </p>
      <Progress value={scanned} max={total} label="Supporters scanned" />
    </>
  );
}
