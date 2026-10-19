import { isPurchaseConfirmationUrl, ParserError, parseViewer, type Viewer } from '../bandcamp';
import { sendMessage } from '../shared/messages';

function readViewer(): Viewer | null {
  // Only the #pagedata element, not the whole page, to keep this cheap on every page view.
  const pagedata = document.getElementById('pagedata');
  if (!pagedata) return null;
  try {
    return parseViewer(pagedata.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('dighead: cannot read the logged-in fan', error);
      return null;
    }
    throw error;
  }
}

/** Tells the worker who is logged in, so it can sync your collection when needed. */
export function reportPage(): void {
  const purchaseConfirmation = isPurchaseConfirmationUrl(new URL(location.href));
  sendMessage('pageSeen', { viewer: readViewer(), purchaseConfirmation }).catch((error: unknown) =>
    console.warn('dighead: worker unreachable', error),
  );
}
