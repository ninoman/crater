import { useMemo } from 'react';
import { parseReleasePage, ParserError, type ReleasePage } from '../../bandcamp';

export type CurrentRelease =
  { state: 'ok'; page: ReleasePage } | { state: 'parser-broken'; detail: string };

/** Parses the release page we're on, once. */
export function useCurrentRelease(): CurrentRelease {
  return useMemo(() => {
    try {
      return { state: 'ok', page: parseReleasePage(document.documentElement.outerHTML) };
    } catch (error) {
      if (error instanceof ParserError) return { state: 'parser-broken', detail: error.message };
      throw error;
    }
  }, []);
}
