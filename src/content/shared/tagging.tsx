import { createContext, useContext } from 'react';

const TaggingContext = createContext(true);

/** Whether tags show on this page. Read once when the page loads (decisions §31). */
export const TaggingProvider = TaggingContext.Provider;

export function useTagging(): boolean {
  return useContext(TaggingContext);
}
