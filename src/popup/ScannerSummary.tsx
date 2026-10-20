import { useScannerControls } from '../hooks/useScannerControls';
import { useScannerStatus } from '../hooks/useScannerStatus';
import type { ScannerStatus } from '../shared/scan';
import { clockTime } from '../shared/timeAgo';
import { Button, Progress, Stat, StatusDot } from '../ui';

function StateLine({ status }: { status: ScannerStatus }) {
  const { pause, queued, lastError, parserError } = status;
  if (parserError) {
    return <StatusDot tone="error">Bandcamp changed its data. Dighead needs an update</StatusDot>;
  }
  switch (pause?.reason) {
    case 'manual':
      return <StatusDot tone="warning">Paused. Nothing is sent until you resume</StatusDot>;
    case 'backoff':
      return (
        <StatusDot tone="warning">
          Paused: Bandcamp asked us to slow down. Resumes at {clockTime(pause.until)}
        </StatusDot>
      );
    case 'budget':
      return (
        <StatusDot tone="warning">Daily request budget reached. Resumes at midnight</StatusDot>
      );
  }
  if (lastError) return <StatusDot tone="error">Last error: {lastError}</StatusDot>;
  return queued.release + queued.fan > 0 ? (
    <StatusDot tone="neutral">Scanning…</StatusDot>
  ) : (
    <StatusDot tone="ok">Idle</StatusDot>
  );
}

function Ready({ status }: { status: ScannerStatus }) {
  const controls = useScannerControls();
  const { queued, fansScanned, requestsToday, dailyBudget } = status;
  const pausedByYou = status.pause?.reason === 'manual';
  const fansKnown = fansScanned + queued.fan;

  return (
    <>
      <div className="dh-scanner__meter">
        <div className="dh-scanner__stats">
          <Stat value={`${fansScanned} / ${fansKnown}`} label="fans scanned" />
          {queued.release > 0 && <Stat value={queued.release} label="releases queued" />}
        </div>
        <Progress value={fansScanned} max={fansKnown} label="Fans scanned" />
      </div>
      <div className="dh-scanner__meter">
        <Stat value={`${requestsToday} / ${dailyBudget}`} label="requests today" />
        <Progress value={requestsToday} max={dailyBudget} label="Daily request budget used" />
      </div>
      <div className="dh-scanner__footer">
        <span className="dh-scanner__state">
          {controls.error ? (
            <StatusDot tone="error">Couldn't reach the scanner: {controls.error}</StatusDot>
          ) : (
            <StateLine status={status} />
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
