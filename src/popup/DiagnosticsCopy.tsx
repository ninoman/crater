import { useCopyDiagnostics } from '../hooks/useCopyDiagnostics';
import { Button, StatusDot } from '../ui';

/** Copies version, scanner state and recent errors, to paste into a bug report. */
export function DiagnosticsCopy() {
  const { status, copy } = useCopyDiagnostics();

  return (
    <section className="dh-danger" aria-label="Diagnostics">
      <div className="dh-danger__text">
        <span className="dh-danger__title">Diagnostics</span>
        <span className="dh-danger__status">
          {status.state === 'copied' && (
            <StatusDot tone="ok">Copied. Paste it into your bug report.</StatusDot>
          )}
          {status.state === 'error' && <StatusDot tone="error">{status.error}</StatusDot>}
          {(status.state === 'idle' || status.state === 'working') &&
            'Recent errors and scanner state, for a bug report. No cookies or account details.'}
        </span>
      </div>
      <Button disabled={status.state === 'working'} onClick={copy}>
        Copy
      </Button>
    </section>
  );
}
