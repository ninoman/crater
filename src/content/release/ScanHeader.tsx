import type { ScanProgressView } from '../../hooks/useScanProgress';
import { NoticeStack, Progress, type NoticeItem } from '../../ui';

/** Where the supporter scan stands, and why the scanner has stopped, if it has. */
export function ScanHeader({
  progress,
  notices,
}: {
  progress: ScanProgressView;
  notices: readonly NoticeItem[];
}) {
  return (
    <div className="dh-scan-header">
      <NoticeStack notices={notices} />
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
