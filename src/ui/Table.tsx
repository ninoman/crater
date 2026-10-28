import type { ReactNode } from 'react';
import { cx } from './cx';
import { InfoHint } from './InfoHint';
import { SkeletonValue } from './Skeleton';

export interface TableColumn<Row, SortKey extends string = string> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligned, with tabular figures. */
  numeric?: boolean;
  /** Makes the header a button that sorts by this key. */
  sortKey?: SortKey;
  /** Explains the column in an ⓘ tooltip after its header. */
  hint?: { label: string; content: ReactNode };
  /** Takes the table's spare width; the other columns shrink to fit their content. */
  grow?: boolean;
  /** Keeps a short multi-word cell, like "↑ closer", on one line. Numeric cells never wrap. */
  nowrap?: boolean;
  /** The cell while a row is on its way; a short block by default. */
  placeholder?: ReactNode;
}

export interface TableProps<Row, SortKey extends string = string> {
  /** Names the table for screen readers. */
  label: string;
  columns: TableColumn<Row, SortKey>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string | number;
  /** The column the rows are sorted by. Sorting is one-way: best (highest) first. */
  sortedBy?: SortKey;
  onSortChange?: (key: SortKey) => void;
  /** Placeholder rows after the real ones, for rows still on their way. */
  placeholderRows?: number;
}

/** A data table whose sortable headers are real buttons, with the active sort in aria-sort. */
export function Table<Row, SortKey extends string = string>({
  label,
  columns,
  rows,
  rowKey,
  sortedBy,
  onSortChange,
  placeholderRows = 0,
}: TableProps<Row, SortKey>) {
  return (
    <table className="dh-table" aria-label={label}>
      <thead>
        <tr>
          {columns.map((column) => {
            const active = column.sortKey !== undefined && column.sortKey === sortedBy;
            return (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  'dh-table__head',
                  column.numeric && 'dh-table__cell--numeric',
                  column.grow && 'dh-table__head--grow',
                )}
                aria-sort={active ? 'descending' : undefined}
              >
                {column.sortKey === undefined || !onSortChange ? (
                  column.header
                ) : (
                  <button
                    type="button"
                    className="dh-table__sort"
                    onClick={() => onSortChange(column.sortKey as SortKey)}
                  >
                    {column.header}
                    <span className="dh-table__sort-mark" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                )}
                {column.hint && (
                  <>
                    {' '}
                    <InfoHint label={column.hint.label}>{column.hint.content}</InfoHint>
                  </>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="dh-table__row">
            {columns.map((column) => (
              <td
                key={column.key}
                className={cx(
                  'dh-table__cell',
                  column.numeric && 'dh-table__cell--numeric',
                  column.nowrap && 'dh-table__cell--nowrap',
                )}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
        {Array.from({ length: placeholderRows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity.
          <tr key={`placeholder-${i}`} className="dh-table__placeholder">
            {columns.map((column) => (
              // Hidden from screen readers: an empty row says nothing.
              <td
                key={column.key}
                className={cx('dh-table__cell', column.numeric && 'dh-table__cell--numeric')}
                aria-hidden="true"
              >
                {column.placeholder ?? <SkeletonValue />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
