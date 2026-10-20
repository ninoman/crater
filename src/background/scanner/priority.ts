// Queue priorities, most urgent first (decisions §5).

/** The release open in the most recent tab, and its supporters. */
export const FOREGROUND = 1;
/** Releases opened earlier, and their supporters. */
export const BACKGROUND = 2;
/** Your own releases, queued after each sync of your collection, and their supporters. */
export const SEED = 3;
