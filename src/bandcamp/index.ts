// Public surface of the Bandcamp module. Import from here, not from individual files.
export {
  collectionPages,
  fetchCollectionPage,
  parseCollectionPage,
  type FetchJson,
} from './collection';
export { BandcampApiError, ParserError } from './errors';
export { followCardHtml } from './followCard';
export { fetchFollowingPage, parseFollowingPage } from './following';
export { parseFanPage } from './fanPage';
export { isPurchaseConfirmationUrl } from './purchase';
export { itemKey, keyFromNumber, keyToNumber, matchKey, parseItemKey } from './keys';
export { fetchReleasePage, parseReleasePage, type FetchText } from './release';
export * from './requests';
export { fetchSupportersPage, parseSupportersPage } from './supporters';
export { FAN_PAGE_DOM } from './fanPageDom';
export { isOwnFanPage, parseViewer } from './viewer';
export { parseViewedFanId } from './viewedFan';
export type * from './types';
