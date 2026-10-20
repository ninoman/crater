import { useRef } from 'react';
import { useTagBackup } from '../hooks/useTagBackup';
import { Button, StatusDot } from '../ui';

/** Export and import of your tags; a re-sync can't rebuild them. */
export function TagBackup() {
  const { status, exportTags, importTags } = useTagBackup();
  const input = useRef<HTMLInputElement>(null);
  const working = status.state === 'working';

  return (
    <section className="dh-danger" aria-label="Tags">
      <div className="dh-danger__text">
        <span className="dh-danger__title">Tags</span>
        <span className="dh-danger__status">
          {status.state === 'exported' && <StatusDot tone="ok">Exported</StatusDot>}
          {status.state === 'imported' && <StatusDot tone="ok">{status.summary}</StatusDot>}
          {status.state === 'error' && <StatusDot tone="error">{status.error}</StatusDot>}
          {(status.state === 'idle' || status.state === 'working') &&
            'Back up your tags, or restore them from a file.'}
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importTags(file);
        }}
      />
      <Button disabled={working} onClick={() => void exportTags()}>
        Export
      </Button>
      <Button disabled={working} onClick={() => input.current?.click()}>
        Import…
      </Button>
    </section>
  );
}
