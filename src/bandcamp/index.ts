// Public surface of the Bandcamp module. Import from here, not from individual files.
export {
  collectionPages,
  fetchCollectionPage,
  parseCollectionPage,
  type FetchJson,
} from './collection';
export { BandcampApiError, ParserError } from './errors';
export { parseFanPage } from './fanPage';
export { isPurchaseConfirmationUrl } from './purchase';
export { itemKey, matchKey, parseItemKey } from './keys';
export { fetchReleasePage, parseReleasePage, type FetchText } from './release';
export * from './requests';
export { fetchSupportersPage, parseSupportersPage } from './supporters';
export { parseViewer } from './viewer';
export type * from './types';
