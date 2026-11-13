// Drag-to-reorder for a grid, by pointer or keyboard, with the feel of the jQuery UI sortable on
// Bandcamp's own collection grid: the card follows the pointer at 75% opacity, a placeholder shows
// where it lands, other cards jump (no sliding), and it settles into place in 100 ms.

import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type Box,
  columnCount,
  edgeScroll,
  indexAtPoint,
  isMoveKey,
  keyboardTarget,
  moveId,
  withArrivals,
} from './sortableGrid';

/** jQuery UI's `revert: 100` on Bandcamp's grid. */
const DROP_MS = 100;
/** Bandcamp's `scrollSensitivity: 100`: how near the window's edge the page starts scrolling. */
const SCROLL_ZONE = 100;
/** The fastest the page scrolls while dragging at the very edge, in pixels per frame. */
const SCROLL_MAX = 20;

export interface SortableGridOptions<Id extends string> {
  ids: readonly Id[];
  enabled: boolean;
  onReorder: (ids: Id[]) => void;
  /** An item's name, for screen reader announcements. */
  describe: (id: Id) => string;
}

interface Drag<Id> {
  id: Id;
  mode: 'pointer' | 'keyboard';
  /** The order when the drag began, to put back on cancel. */
  start: readonly Id[];
  order: readonly Id[];
  /** Pointer drags: settling into the placeholder, or back to the start when cancelled. */
  dropping: 'commit' | 'cancel' | null;
}

interface Point {
  x: number;
  y: number;
}

export interface HandleProps {
  ref: (el: HTMLButtonElement | null) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: (event: FocusEvent<HTMLButtonElement>) => void;
}

export interface OverlayState<Id> {
  id: Id;
  ref: (el: HTMLDivElement | null) => void;
  /** Where it starts, in viewport pixels; pointer moves then place it directly. */
  left: number;
  top: number;
  width: number;
}

export interface SortableGrid<Id> {
  /** The ids in the order to show them, the drag included. */
  order: readonly Id[];
  active: Id | null;
  mode: Drag<Id>['mode'] | null;
  itemRef: (id: Id) => (el: HTMLElement | null) => void;
  handleProps: (id: Id) => HandleProps;
  overlay: OverlayState<Id> | null;
  /** The latest thing to say to a screen reader. */
  announcement: string;
}

/** Keeps one callback or object per id, so memoised items don't re-render for new ones. */
function useCache<Id, T>(): Map<Id, T> {
  return useRef(new Map<Id, T>()).current;
}

export function useSortableGrid<Id extends string>(
  options: SortableGridOptions<Id>,
): SortableGrid<Id> {
  const [drag, setDrag] = useState<Drag<Id> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [overlayStart, setOverlayStart] = useState<Omit<OverlayState<Id>, 'id' | 'ref'> | null>(
    null,
  );
  const latest = useRef({ options, drag });
  latest.current = { options, drag };

  const items = useCache<Id, HTMLElement>();
  const handles = useCache<Id, HTMLButtonElement>();
  const itemRefs = useCache<Id, (el: HTMLElement | null) => void>();
  const handlePropsCache = useCache<Id, HandleProps>();
  const overlay = useRef<HTMLDivElement | null>(null);
  /** Pointer position within the card when it was picked up. */
  const grab = useRef<Point>({ x: 0, y: 0 });
  const pointer = useRef<Point>({ x: 0, y: 0 });

  const order = useMemo(
    () => (drag ? withArrivals(drag.order, options.ids) : options.ids),
    [drag, options.ids],
  );
  const orderRef = useRef(order);
  orderRef.current = order;

  function boxes(ids: readonly Id[]): (Box | null)[] {
    return ids.map((id) => items.get(id)?.getBoundingClientRect() ?? null);
  }

  function position(ids: readonly Id[], id: Id): string {
    return `position ${ids.indexOf(id) + 1} of ${ids.length}`;
  }

  function moveTo(to: number) {
    setDrag((current) => {
      if (!current || current.order[to] === current.id) return current;
      return {
        ...current,
        order: moveId(withArrivals(current.order, latest.current.options.ids), current.id, to),
      };
    });
  }

  function finish(commit: boolean) {
    const current = latest.current.drag;
    if (!current) return;
    const final = orderRef.current;
    const changed = commit && final.some((id, i) => current.start[i] !== id);
    // In one batch with the parent's new order, so the old one never flashes back.
    if (changed) latest.current.options.onReorder([...final]);
    setDrag(null);
    setOverlayStart(null);
  }

  // A pointer drag: follow the pointer, move the placeholder, scroll near the window's edges.
  const pointerDragging = drag?.mode === 'pointer' && drag.dropping === null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the helpers read refs only
  useEffect(() => {
    if (!pointerDragging) return;
    let frame = 0;

    function place() {
      const el = overlay.current;
      if (!el) return;
      el.style.left = `${pointer.current.x - grab.current.x}px`;
      el.style.top = `${pointer.current.y - grab.current.y}px`;
    }

    function retarget() {
      const ids = orderRef.current;
      const index = indexAtPoint(boxes(ids), pointer.current.x, pointer.current.y);
      if (index >= 0) moveTo(index);
    }

    function scroll() {
      const by = edgeScroll(pointer.current.y, window.innerHeight, SCROLL_ZONE, SCROLL_MAX);
      if (by === 0) {
        frame = 0;
        return;
      }
      window.scrollBy(0, by);
      retarget();
      frame = requestAnimationFrame(scroll);
    }

    function onMove(event: globalThis.PointerEvent) {
      pointer.current = { x: event.clientX, y: event.clientY };
      place();
      retarget();
      if (frame === 0) frame = requestAnimationFrame(scroll);
    }

    function onUp() {
      setDrag((current) => current && { ...current, dropping: 'commit' });
    }

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDrag((current) => current && { ...current, order: current.start, dropping: 'cancel' });
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [pointerDragging]);

  // Settling: slide the copy onto the placeholder, then drop it there.
  const dropping = drag?.mode === 'pointer' ? drag.dropping : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per drop; the rest is read then
  useLayoutEffect(() => {
    if (!dropping || !drag) return;
    const el = overlay.current;
    const target = items.get(drag.id)?.getBoundingClientRect();
    if (el && target) {
      el.style.transition = `left ${DROP_MS}ms, top ${DROP_MS}ms`;
      el.style.left = `${target.left}px`;
      el.style.top = `${target.top}px`;
    }
    const timer = setTimeout(() => finish(dropping === 'commit'), DROP_MS);
    return () => clearTimeout(timer);
  }, [dropping]);

  // A keyboard move re-inserts the card; keep focus on its handle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `handles` is a stable map
  useLayoutEffect(() => {
    if (drag?.mode === 'keyboard') handles.get(drag.id)?.focus();
  }, [drag]);

  // Turned off mid-drag, e.g. a filter came on: put everything back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when `enabled` changes
  useEffect(() => {
    if (!options.enabled && latest.current.drag) finish(false);
  }, [options.enabled]);

  function startPointer(id: Id, event: PointerEvent<HTMLButtonElement>) {
    const { options: opts, drag: current } = latest.current;
    if (!opts.enabled || current || event.button !== 0) return;
    const card = items.get(id)?.getBoundingClientRect();
    if (!card) return;
    // Keeps the browser from selecting text as the pointer moves.
    event.preventDefault();
    grab.current = { x: event.clientX - card.left, y: event.clientY - card.top };
    pointer.current = { x: event.clientX, y: event.clientY };
    setOverlayStart({ left: card.left, top: card.top, width: card.width });
    setDrag({
      id,
      mode: 'pointer',
      start: orderRef.current,
      order: orderRef.current,
      dropping: null,
    });
  }

  function keyDown(id: Id, event: KeyboardEvent<HTMLButtonElement>) {
    const { options: opts, drag: current } = latest.current;
    const name = opts.describe(id);
    const ids = orderRef.current;
    const pick = event.key === ' ' || event.key === 'Enter';
    if (!current) {
      if (!pick || !opts.enabled) return;
      event.preventDefault();
      setDrag({ id, mode: 'keyboard', start: ids, order: ids, dropping: null });
      setAnnouncement(
        `Picked up ${name}, ${position(ids, id)}. Arrow keys move it, Space drops it, Escape cancels.`,
      );
      return;
    }
    if (current.mode !== 'keyboard' || current.id !== id) return;
    if (pick) {
      event.preventDefault();
      setAnnouncement(`Dropped ${name} at ${position(ids, id)}.`);
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setAnnouncement(`Cancelled. ${name} is back at ${position(current.start, id)}.`);
      finish(false);
    } else if (isMoveKey(event.key)) {
      event.preventDefault();
      const from = ids.indexOf(id);
      const to = keyboardTarget(from, event.key, columnCount(boxes(ids)), ids.length);
      if (to === from) return;
      moveTo(to);
      setAnnouncement(`${name}, ${position(moveId(ids, id, to), id)}.`);
    }
  }

  function blur(id: Id, event: FocusEvent<HTMLButtonElement>) {
    const current = latest.current.drag;
    // relatedTarget is null when a move re-inserts the card; only a real focus change cancels.
    if (current?.mode === 'keyboard' && current.id === id && event.relatedTarget !== null) {
      setAnnouncement(`Cancelled. ${latest.current.options.describe(id)} is back where it was.`);
      finish(false);
    }
  }

  function itemRef(id: Id) {
    let ref = itemRefs.get(id);
    if (!ref) {
      ref = (el) => {
        if (el) items.set(id, el);
        else items.delete(id);
      };
      itemRefs.set(id, ref);
    }
    return ref;
  }

  function handleProps(id: Id): HandleProps {
    let props = handlePropsCache.get(id);
    if (!props) {
      props = {
        ref: (el) => {
          if (el) handles.set(id, el);
          else handles.delete(id);
        },
        onPointerDown: (event) => startPointer(id, event),
        onKeyDown: (event) => keyDown(id, event),
        onBlur: (event) => blur(id, event),
      };
      handlePropsCache.set(id, props);
    }
    return props;
  }

  return {
    order,
    active: drag?.id ?? null,
    mode: drag?.mode ?? null,
    itemRef,
    handleProps,
    overlay:
      drag?.mode === 'pointer' && overlayStart
        ? { id: drag.id, ref: (el) => (overlay.current = el), ...overlayStart }
        : null,
    announcement,
  };
}
