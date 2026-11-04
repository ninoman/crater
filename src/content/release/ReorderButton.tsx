import { Button, ReorderIcon, Tooltip } from '../../ui';

/** Shown once re-scores have ranked the list differently from how it sits. */
export function ReorderButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Re-sort by the latest scores. The list holds still until you do.">
      <Button variant="ghost" icon aria-label="Update the order of Also bought" onClick={onClick}>
        <ReorderIcon />
      </Button>
    </Tooltip>
  );
}
