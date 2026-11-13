// Pure geometry and moves for a sortable grid (useSortableGrid).

/** A laid-out item, as getBoundingClientRect gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** `ids` with `id` taken out and put back at `to`. */
export function moveId<Id>(ids: readonly Id[], id: Id, to: number): Id[] {
  const rest = ids.filter((other) => other !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** The index of the box under the point, or -1 over a gap. Like jQuery UI's "pointer" tolerance. */
export function indexAtPoint(boxes: readonly (Box | null)[], x: number, y: number): number {
  return boxes.findIndex(
    (box) => box !== null && x >= box.left && x < box.right && y >= box.top && y < box.bottom,
  );
}

/** How many items fit in a row: those on the first item's line. */
export function columnCount(boxes: readonly (Box | null)[]): number {
  const first = boxes.find((box) => box !== null);
  if (!first) return 1;
  const columns = boxes.filter((box) => box !== null && Math.abs(box.top - first.top) < 1).length;
  return Math.max(1, columns);
}

export type MoveKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function isMoveKey(key: string): key is MoveKey {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key);
}

/** Where a key moves the item at `index` in a grid of `length` items, `columns` to a row. */
export function keyboardTarget(
  index: number,
  key: MoveKey,
  columns: number,
  length: number,
): number {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return Math.max(0, Math.min(length - 1, index + step[key]));
}

/**
 * Pixels to scroll the window this frame while dragging at `y`: faster the nearer the edge,
 * within `zone` of the top or bottom of a window `height` tall. Negative scrolls up.
 */
export function edgeScroll(y: number, height: number, zone: number, max: number): number {
  if (y < zone) return -Math.ceil(max * ((zone - y) / zone));
  if (y > height - zone) return Math.ceil(max * ((y - (height - zone)) / zone));
  return 0;
}

/** The ids of a drag in progress, with ids that arrived since added at the end. */
export function withArrivals<Id>(order: readonly Id[], ids: readonly Id[]): Id[] {
  const current = new Set(ids);
  const kept = order.filter((id) => current.has(id));
  const seen = new Set(kept);
  return [...kept, ...ids.filter((id) => !seen.has(id))];
}
