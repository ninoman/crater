import { useScannerControls } from '../hooks/useScannerControls';
import { useScannerStatus } from '../hooks/useScannerStatus';
import type { ScannerStatus } from '../shared/scan';
import { describeScannerNotice, scannerNotices } from '../shared/scannerNotices';
import { Button, NoticeStack, Progress, Stat, StatusDot } from '../ui';

/** The one-line state. Why it's stopped, other than by you, is in the notices above. */
function StateLine({ status, stopped }: { status: ScannerStatus; stopped: boolean }) {
  const { pause, queued, lastError } = status;
  if (pause?.reason === 'manual') {
    return <StatusDot tone="warning">Paused. Nothing is sent until you resume</StatusDot>;
  }
  if (pause?.reason === 'import') {
    return <StatusDot tone="warning">Paused while a backup is imported</StatusDot>;
  }
  if (stopped) return <StatusDot tone="warning">Not scanning right now</StatusDot>;
  if (lastError) return <StatusDot tone="error">Last error: {lastError}</StatusDot>;
  return queued.release + queued.fan > 0 ? (
    <StatusDot tone="neutral">Scanning…</StatusDot>
  ) : (
    <StatusDot tone="ok">Idle</StatusDot>
  );
}

function Ready({ status }: { status: ScannerStatus }) {
  const controls = useScannerControls();
  const { queued, fansScanned, ownReleases, requestsToday, dailyBudget, paceFactor } = status;
  const pausedByYou = status.pause?.reason === 'manual';
  const fansKnown = fansScanned + queued.fan;
  const now = Date.now();
  // Your own pause has its Resume button right here, so it needs no notice.
  const notices = scannerNotices(status)
    .filter(({ kind }) => kind !== 'paused-by-you')
    .map((notice) => describeScannerNotice(notice, now));

  return (
    <>
      <NoticeStack notices={notices} />
      <div className="dh-scanner__meter">
        <div className="dh-scanner__stats">
          <Stat value={`${fansScanned} / ${fansKnown}`} label="fans scanned" />
          {queued.release > 0 && <Stat value={queued.release} label="releases queued" />}
        </div>
        <Progress value={fansScanned} max={fansKnown} label="Fans scanned" />
      </div>
      {ownReleases.total > 0 && (
        <div className="dh-scanner__meter">
          <div className="dh-scanner__stats">
            <Stat
              value={`${ownReleases.scanned} / ${ownReleases.total}`}
              label="your releases scanned"
            />
          </div>
          <Progress
            value={ownReleases.scanned}
            max={ownReleases.total}
            label="Your releases scanned"
          />
        </div>
      )}
      <div className="dh-scanner__meter">
        <div className="dh-scanner__stats">
          <Stat value={`${requestsToday} / ${dailyBudget}`} label="requests today" />
          <Stat value={`×${(1 / paceFactor).toFixed(1)}`} label="pace" />
        </div>
        <Progress value={requestsToday} max={dailyBudget} label="Daily request budget used" />
      </div>
      <div className="dh-scanner__footer">
        <span className="dh-scanner__state">
          {controls.error ? (
            <StatusDot tone="error">Couldn't reach the scanner: {controls.error}</StatusDot>
          ) : (
            <StateLine status={status} stopped={notices.length > 0} />
          )}
        </span>
        {pausedByYou ? (
          <Button variant="primary" onClick={controls.resume} disabled={controls.pending}>
            Resume
          </Button>
        ) : (
          <Button onClick={controls.pause} disabled={controls.pending}>
            Pause
          </Button>
        )}
      </div>
    </>
  );
}

/** The background scanner: queue progress, today's budget, why it's paused, and pause/resume. */
export function ScannerSummary() {
  const view = useScannerStatus();

  return (
    <section className="dh-scanner" aria-label="Scanner">
      {view.state === 'loading' && <StatusDot tone="neutral">Loading scanner…</StatusDot>}
      {view.state === 'unreachable' && <StatusDot tone="error">Scanner unreachable</StatusDot>}
      {view.state === 'ready' && <Ready status={view.status} />}
    </section>
  );
}
