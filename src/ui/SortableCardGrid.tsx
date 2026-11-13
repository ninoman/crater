import { type ReactNode, type Ref, useId, useMemo, useRef } from 'react';
import { type CardDragState, CardGrid } from './Card';
import { cx } from './cx';
import { DragHandle } from './DragHandle';
import { useSortableGrid } from './useSortableGrid';

/** What a card in a SortableCardGrid passes on to its Card. */
export interface SortableSlot {
  ref?: Ref<HTMLLIElement>;
  handle?: ReactNode;
  dragState?: CardDragState;
}

export interface SortableCardGridProps<T, Id extends string> {
  label: string;
  items: readonly T[];
  getId: (item: T) => Id;
  /** An item's name, for its handle's label and screen reader announcements. */
  describe: (item: T) => string;
  /** Off: no handles, as on a filtered list. */
  enabled: boolean;
  onReorder: (ids: Id[]) => void;
  /** Renders a Card, passing the slot's ref, handle and drag state to it. */
  renderCard: (item: T, slot: SortableSlot | null) => ReactNode;
}

/** A CardGrid whose cards can be dragged into a new order, by their handle or the keyboard. */
export function SortableCardGrid<T, Id extends string>({
  label,
  items,
  getId,
  describe,
  enabled,
  onReorder,
  renderCard,
}: SortableCardGridProps<T, Id>) {
  const instructions = useId();
  const byId = useMemo(() => new Map(items.map((item) => [getId(item), item])), [items, getId]);
  const ids = useMemo(() => items.map(getId), [items, getId]);
  const name = (id: Id) => {
    const item = byId.get(id);
    return item ? describe(item) : '';
  };
  const grid = useSortableGrid({ ids, enabled, onReorder, describe: name });
  const slots = useRef(new Map<Id, { key: string; slot: SortableSlot }>()).current;

  function slotFor(id: Id): SortableSlot | null {
    if (!enabled && grid.active === null) return null;
    const dragState: CardDragState | undefined =
      grid.active !== id ? undefined : grid.mode === 'keyboard' ? 'lifted' : 'placeholder';
    const label = name(id);
    const key = `${dragState ?? ''}|${label}`;
    const cached = slots.get(id);
    if (cached?.key === key) return cached.slot;
    const slot: SortableSlot = {
      ref: grid.itemRef(id),
      dragState,
      handle: (
        <DragHandle
          label={`Move ${label}`}
          describedBy={instructions}
          lifted={dragState === 'lifted'}
          {...grid.handleProps(id)}
        />
      ),
    };
    slots.set(id, { key, slot });
    return slot;
  }

  const dragged = grid.overlay ? byId.get(grid.overlay.id) : undefined;
  return (
    <>
      <CardGrid label={label} className={cx(grid.mode === 'pointer' && 'dh-card-grid--dragging')}>
        {grid.order.map((id) => {
          const item = byId.get(id);
          return item === undefined ? null : renderCard(item, slotFor(id));
        })}
      </CardGrid>
      {grid.overlay && dragged !== undefined && (
        <div
          ref={grid.overlay.ref}
          className="dh-sortable-overlay"
          style={{ left: grid.overlay.left, top: grid.overlay.top, width: grid.overlay.width }}
          aria-hidden="true"
          inert
        >
          <ul className="dh-card-grid dh-card-grid--overlay">
            {renderCard(dragged, { dragState: 'overlay' })}
          </ul>
        </div>
      )}
      {enabled && (
        <p id={instructions} className="dh-visually-hidden">
          Press Space to pick it up, the arrow keys to move it, and Space again to drop it. Escape
          puts it back.
        </p>
      )}
      <p className="dh-visually-hidden" role="status">
        {grid.announcement}
      </p>
    </>
  );
}
