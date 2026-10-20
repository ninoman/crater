import type { ReactNode } from 'react';
import { cx } from './cx';

export interface TableColumn<Row, SortKey extends string = string> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligned, with tabular figures. */
  numeric?: boolean;
  /** Makes the header a button that sorts by this key. */
  sortKey?: SortKey;
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
}

/** A data table whose sortable headers are real buttons, with the active sort in aria-sort. */
export function Table<Row, SortKey extends string = string>({
  label,
  columns,
  rows,
  rowKey,
  sortedBy,
  onSortChange,
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
                className={cx('dh-table__head', column.numeric && 'dh-table__cell--numeric')}
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
                className={cx('dh-table__cell', column.numeric && 'dh-table__cell--numeric')}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
