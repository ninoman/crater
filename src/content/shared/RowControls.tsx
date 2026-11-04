// What every recommended row and list shares: preview through the list's player, heard, hide,
// the bar that plays the list through, the docked player, and the switch that hides heard rows
// (decisions §22).

import type { ListPlayer, ListPlayerRow } from '../../hooks/useListPlayer';
import type { ActionableRow, RowActions } from '../../hooks/rowActions';
import {
  AudioPlayer,
  Checkbox,
  Dock,
  NowPlaying,
  PlayQueueBar,
  type ReleaseRowProps,
} from '../../ui';
import { hideScopeNames, hideTargetFor } from './hideTargets';
import { previewPlayerState } from './ReleasePreview';

type RowControlProps = Pick<
  ReleaseRowProps,
  'previewing' | 'preview' | 'onPreview' | 'heard' | 'onHeardChange' | 'hideScopes' | 'onHide'
>;

type NamedRow = ActionableRow & { artist: string; title: string };

/**
 * A row's preview, heard and hide props, wired to its list's player and actions. `placement`
 * says where the player shows: under the playing row (the release sidebar's narrow lists), or in
 * the `ListNowPlaying` the list renders (profile tabs, like their other players).
 */
export function rowControls(
  row: NamedRow,
  player: ListPlayer,
  actions: RowActions,
  placement: 'inline' | 'docked',
): RowControlProps {
  const previewing = player.current === row.matchKey;
  return {
    previewing,
    preview: placement === 'inline' && previewing && (
      <ListAudioPlayer player={player} name={nameOf(row)} />
    ),
    onPreview: (open) => (open ? player.play(row.matchKey) : player.stop()),
    heard: row.heard,
    onHeardChange: (heard) => actions.setHeard(row.matchKey, heard, true),
    hideScopes: hideScopeNames(row.hide),
    onHide: (scope) => {
      const target = hideTargetFor(row, scope);
      if (!target) return;
      player.hidden(target);
      actions.hide(target);
    },
  };
}

/** The playing row's player, docked at the bottom of the window like every profile tab's. */
export function ListNowPlaying({ player }: { player: ListPlayer<ListPlayerRow & NamedRow> }) {
  const row = player.rows.find((candidate) => candidate.matchKey === player.current);
  if (!row) return null;
  const name = nameOf(row);
  return (
    <Dock>
      <NowPlaying name={name} href={row.url} onStop={player.stop}>
        <ListAudioPlayer player={player} name={name} />
      </NowPlaying>
    </Dock>
  );
}

function ListAudioPlayer({ player, name }: { player: ListPlayer; name: string }) {
  return (
    <AudioPlayer
      state={previewPlayerState(player.view)}
      label={name}
      onToggle={player.toggle}
      onSeek={player.seek}
      onPreviousTrack={player.previousTrack}
      onNextTrack={player.nextTrack}
    />
  );
}

function nameOf(row: NamedRow): string {
  return `${row.artist} – ${row.title}`;
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
