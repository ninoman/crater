import { Button, EmptyState } from '../../ui';

/** A list emptied by "Hide heard", with the way back (decisions §22). */
export function AllHeard({ onShowHeard }: { onShowHeard: () => void }) {
  return (
    <EmptyState
      title="Nothing here you haven't heard"
      description="Hide heard is on, so releases you've listened to or marked as heard are left out."
      action={<Button onClick={onShowHeard}>Show heard releases</Button>}
    />
  );
}
