import type { ItemKey } from '../../bandcamp';
import type { AlsoBoughtView } from '../../hooks/useAlsoBought';
import type { ListFiltersState } from '../../hooks/useListFilters';
import type { ScanProgressView } from '../../hooks/useScanProgress';
import { NO_FILTERS } from '../../shared/listFilters';
import { ListFilterBar } from '../../ui';
import { FILTER_GENRES } from '../shared/filterGenres';
import { NoMatches } from '../shared/NoMatches';
import { AlsoBoughtList } from './AlsoBoughtList';

export interface AlsoBoughtTabProps {
  view: AlsoBoughtView;
  filters: ListFiltersState;
  progress: ScanProgressView;
  scanStopped: boolean;
  showEarly: boolean;
  onHide: (matchKey: ItemKey) => void;
}

/** The filter bar over the Also-bought list, or over "nothing matches" once the list is final. */
export function AlsoBoughtTab({ view, filters, ...list }: AlsoBoughtTabProps) {
  const result = view.state === 'ready' ? view.result : null;
  const filtered = result?.filtered;
  // During the warm-up an empty list means "still gathering", which the list says best.
  const noMatches =
    result && filtered && result.rows.length === 0 && !result.warmup && filtered.summary.hidden > 0;

  return (
    <>
      <ListFilterBar
        filters={filters.filters}
        onChange={filters.setFilters}
        genres={FILTER_GENRES}
        place={filters.place}
        summary={filtered?.summary ?? null}
      />
      {noMatches ? (
        <NoMatches summary={filtered.summary} onClear={() => filters.setFilters(NO_FILTERS)} />
      ) : (
        <AlsoBoughtList view={view} {...list} />
      )}
    </>
  );
}
