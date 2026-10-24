// What every recommended row and list shares: preview through the list's player, heard, hide,
// the bar that plays the list through, and the switch that hides heard rows (decisions §22).

import type { ListPlayer } from '../../hooks/useListPlayer';
import type { ActionableRow, RowActions } from '../../hooks/rowActions';
import { AudioPlayer, Checkbox, PlayQueueBar, type ReleaseRowProps } from '../../ui';
import { hideScopeNames, hideTargetFor } from './hideTargets';
import { previewPlayerState } from './ReleasePreview';

type RowControlProps = Pick<
  ReleaseRowProps,
  'previewing' | 'preview' | 'onPreview' | 'heard' | 'onHeardChange' | 'hideScopes' | 'onHide'
>;

/** A row's preview, heard and hide props, wired to its list's player and actions. */
export function rowControls(
  row: ActionableRow & { artist: string; title: string },
  player: ListPlayer,
  actions: RowActions,
): RowControlProps {
  const name = `${row.artist} – ${row.title}`;
  const previewing = player.current === row.matchKey;
  return {
    previewing,
    preview: previewing && (
      <AudioPlayer
        state={previewPlayerState(player.view)}
        label={name}
        onToggle={player.toggle}
        onSeek={player.seek}
      />
    ),
    onPreview: (open) => (open ? player.play(row.matchKey) : player.stop()),
    heard: row.heard,
    onHeardChange: (heard) => actions.setHeard(row.matchKey, heard, true),
    hideScopes: hideScopeNames(row.hide),
    onHide: (scope) => {
      const target = hideTargetFor(row, scope);
      if (target) actions.hide(target);
    },
  };
}

/** Play all, or the queue's controls while it plays. */
export function PlayThrough({ player }: { player: ListPlayer }) {
  return (
    <PlayQueueBar
      position={player.position}
      total={player.total}
      playing={player.view.state === 'ready' && player.view.playing}
      onPlayAll={player.playAll}
      onToggle={player.toggle}
      onPrevious={player.previous}
      onNext={player.next}
      onStop={player.stop}
    />
  );
}

/** Leaves heard releases out of the list. Shown in every state, so an emptied list can undo it. */
export function HideHeardToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (hideHeard: boolean) => void;
}) {
  return <Checkbox label="Hide heard" checked={checked} onChange={onChange} />;
}
