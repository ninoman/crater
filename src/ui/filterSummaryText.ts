import type { FilterSummary } from '../shared/listFilters';
import { FILTER_SEARCH_LIMIT } from '../shared/listFilters';

/** "12 hidden by filters", and why some of them may be there by mistake (decisions §22). */
export function formatFilterSummary({ hidden, unjudged, limited }: FilterSummary): string {
  const parts = [hidden === 0 ? 'Nothing hidden by filters' : `${hidden} hidden by filters`];
  if (unjudged > 0) {
    parts.push(
      unjudged === 1
        ? "1 of them couldn't be judged: Dighead hasn't seen that detail yet"
        : `${unjudged} of them couldn't be judged: Dighead hasn't seen that detail yet`,
    );
  }
  if (limited) {
    parts.push(
      `only the best ${FILTER_SEARCH_LIMIT.toLocaleString('en-US')} candidates were checked`,
    );
  }
  return parts.join(' · ');
}
