import { cx } from './cx';

export interface SkeletonRowsProps {
  count: number;
  /** Still, for a wait that isn't moving (e.g. the scanner is stopped). */
  paused?: boolean;
  /** Leaves room for a rank before the cover, as ranked ReleaseRows have. */
  ranked?: boolean;
}

/** Placeholder rows shaped like ReleaseRows in a RowList: cover, title and two meta lines. */
export function SkeletonRows({ count, paused = false, ranked = false }: SkeletonRowsProps) {
  return (
    <ul className={cx('dh-skeleton', paused && 'dh-skeleton--paused')} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity.
        <li key={i} className="dh-skeleton__row">
          {ranked && <span className="dh-skeleton__block dh-skeleton__rank" />}
          <span className="dh-skeleton__block dh-skeleton__cover" />
          <span className="dh-skeleton__text">
            <span className="dh-skeleton__block dh-skeleton__line dh-skeleton__line--title" />
            <span className="dh-skeleton__block dh-skeleton__line dh-skeleton__line--meta" />
            <span className="dh-skeleton__block dh-skeleton__line dh-skeleton__line--short" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A placeholder avatar and name, as an Identity cell. */
export function SkeletonPerson() {
  return (
    <span className="dh-skeleton__person">
      <span className="dh-skeleton__block dh-skeleton__avatar" />
      <span className="dh-skeleton__block dh-skeleton__name" />
    </span>
  );
}

/** A placeholder strip of covers. */
export function SkeletonCovers({ count }: { count: number }) {
  return (
    <span className="dh-skeleton__strip">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity.
        <span key={i} className="dh-skeleton__block dh-skeleton__cover" />
      ))}
    </span>
  );
}

/** A placeholder for a short value, such as a number in a table cell. */
export function SkeletonValue() {
  return <span className="dh-skeleton__block dh-skeleton__number" />;
}

export interface SkeletonPeopleTableProps {
  count: number;
  paused?: boolean;
  /** Covers in each row's strip. */
  covers: number;
  /** Narrow number columns after the strip. */
  numbers: number;
}

/**
 * Placeholder rows shaped like a Table of people, for when there's no table yet: rank, avatar
 * and name, a strip of covers and number columns, in Table's own cells.
 */
export function SkeletonPeopleTable({
  count,
  paused = false,
  covers,
  numbers,
}: SkeletonPeopleTableProps) {
  const numberCells = Array.from({ length: numbers }, (_, i) => i);
  return (
    <table
      className={cx('dh-table', 'dh-skeleton', paused && 'dh-skeleton--paused')}
      aria-hidden="true"
    >
      <tbody>
        {Array.from({ length: count }, (_, row) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity.
          <tr key={row} className="dh-table__placeholder">
            <td className="dh-table__cell">
              <SkeletonValue />
            </td>
            <td className="dh-table__cell">
              <SkeletonPerson />
            </td>
            <td className="dh-table__cell dh-table__head--grow">
              <SkeletonCovers count={covers} />
            </td>
            {numberCells.map((i) => (
              <td key={i} className="dh-table__cell">
                <SkeletonValue />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
