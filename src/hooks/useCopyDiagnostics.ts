import { useCallback, useState } from 'react';
import { formatDiagnostics } from '../shared/diagnostics';
import { sendMessage } from '../shared/messages';

export type CopyDiagnosticsStatus =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'copied' }
  | { state: 'error'; error: string };

export interface CopyDiagnostics {
  status: CopyDiagnosticsStatus;
  copy: () => void;
}

/** Copies a diagnostics report to the clipboard, ready to paste into a bug report. */
export function useCopyDiagnostics(): CopyDiagnostics {
  const [status, setStatus] = useState<CopyDiagnosticsStatus>({ state: 'idle' });

  const copy = useCallback(() => {
    setStatus({ state: 'working' });
    sendMessage('getDiagnostics', {})
      .then((diagnostics) => navigator.clipboard.writeText(formatDiagnostics(diagnostics)))
      .then(
        () => setStatus({ state: 'copied' }),
        (error: unknown) =>
          setStatus({
            state: 'error',
            error: error instanceof Error ? error.message : String(error),
          }),
      );
  }, []);

  return { status, copy };
}
