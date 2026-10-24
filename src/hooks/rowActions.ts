// Hide and heard on a list's rows (decisions §22), shared by For you, Also bought and Crate mates'
// latest: drop or flag the row at once, tell the worker, then let the list reload.

import { type Dispatch, type SetStateAction, useCallback } from 'react';
import type { ItemKey } from '../bandcamp';
import type { HideScopes, HideTarget } from '../shared/hide';
import { sendMessage } from '../shared/messages';

/** What every recommended row carries for hiding and heard. */
export interface ActionableRow {
  matchKey: ItemKey;
  heard: boolean;
  hide: HideScopes;
}

/** A list view: only `ready` has rows. */
type RowsView<R> = { state: string; result?: { rows: R[] } };

/** Whether a hide takes this row out. Rows don't carry their account ids beyond their scopes. */
export function coveredBy(target: HideTarget, row: ActionableRow): boolean {
  switch (target.kind) {
    case 'release':
      return row.matchKey === target.matchKey;
    case 'band':
      return row.hide.band?.bandId === target.bandId;
    case 'label':
      return row.hide.label?.labelId === target.labelId;
  }
}

/** The view with its rows changed; views without rows stay as they are. */
export function withRows<R, V extends RowsView<R>>(view: V, update: (rows: R[]) => R[]): V {
  return view.result
    ? { ...view, result: { ...view.result, rows: update(view.result.rows) } }
    : view;
}

export interface RowActions {
  /** Takes the target's rows out now, saves the hide, then reloads so the next picks move up. */
  hide: (target: HideTarget) => void;
  /**
   * Flags or unflags a row as heard. `save` sends it to the worker: true for a manual mark, false
   * when the player has already saved it.
   */
  setHeard: (matchKey: ItemKey, heard: boolean, save: boolean) => void;
}

export function useRowActions<R extends ActionableRow, V extends RowsView<R>>(
  setView: Dispatch<SetStateAction<V>>,
  reload: () => unknown,
  onError: (error: unknown) => void,
): RowActions {
  const hide = useCallback(
    (target: HideTarget) => {
      setView((current) =>
        withRows<R, V>(current, (rows) => rows.filter((row) => !coveredBy(target, row))),
      );
      sendMessage('hide', { target }).then(reload, onError);
    },
    [setView, reload, onError],
  );

  const setHeard = useCallback(
    (matchKey: ItemKey, heard: boolean, save: boolean) => {
      setView((current) =>
        withRows<R, V>(current, (rows) =>
          rows.map((row) => (row.matchKey === matchKey ? { ...row, heard } : row)),
        ),
      );
      if (!save) return;
      const saved = heard
        ? sendMessage('markHeard', { itemKey: matchKey, source: 'manual' })
        : sendMessage('unmarkHeard', { matchKey });
      saved.catch(onError);
    },
    [setView, onError],
  );

  return { hide, setHeard };
}
