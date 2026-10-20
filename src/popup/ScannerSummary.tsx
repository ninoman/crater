import type { ScannerStatus } from '../shared/scan';
import { useScannerStatus } from '../hooks/useScannerStatus';
import { Stat, StatusDot } from '../ui';

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StateLine({ status }: { status: ScannerStatus }) {
  const { pause, queued, lastError } = status;
  if (pause?.reason === 'backoff') {
    return (
      <StatusDot tone="warning">
        Paused: Bandcamp asked us to slow down. Resumes at {clockTime(pause.until)}
      </StatusDot>
    );
  }
  if (pause?.reason === 'budget') {
    return <StatusDot tone="warning">Daily request budget reached. Resumes at midnight</StatusDot>;
  }
  if (lastError) return <StatusDot tone="error">Last error: {lastError}</StatusDot>;
  return queued.release + queued.fan > 0 ? (
    <StatusDot tone="neutral">Scanning…</StatusDot>
  ) : (
    <StatusDot tone="ok">Idle</StatusDot>
  );
}

/** The background scanner: what's queued, today's requests, and why it's paused if it is. */
export function ScannerSummary() {
  const view = useScannerStatus();

  return (
    <section className="dh-scanner" aria-label="Scanner">
      {view.state === 'loading' && <StatusDot tone="neutral">Loading scanner…</StatusDot>}
      {view.state === 'unreachable' && <StatusDot tone="error">Scanner unreachable</StatusDot>}
      {view.state === 'ready' && (
        <>
          <div className="dh-scanner__stats">
            <Stat value={view.status.queued.fan} label="fans queued" />
            <Stat
              value={`${view.status.requestsToday} / ${view.status.dailyBudget}`}
              label="requests today"
            />
          </div>
          <span className="dh-scanner__state">
            <StateLine status={view.status} />
          </span>
        </>
      )}
    </section>
  );
}
