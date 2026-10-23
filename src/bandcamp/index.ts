// Public surface of the Bandcamp module. Import from here, not from individual files.
export {
  collectionPages,
  fetchCollectionPage,
  parseCollectionPage,
  type FetchJson,
} from './collection';
export { hasTralbumItem, parseBandId } from './bandPage';
export { BAND_PAGE_DOM } from './bandPageDom';
export { isCompilation } from './compilation';
export { BandcampApiError, ParserError } from './errors';
export { followCardHtml } from './followCard';
export { fetchFollowingPage, parseFollowingPage } from './following';
export { parseFanPage } from './fanPage';
export { fetchFanProfile, parseFanProfile } from './fanProfile';
export { isPurchaseConfirmationUrl } from './purchase';
export { itemKey, keyFromNumber, keyToNumber, matchKey, parseItemKey } from './keys';
export { findReleaseLinks, releaseUrl, type PageReleaseLink } from './pageLinks';
export { parsePageDesign } from './pageDesign';
export { fetchReleasePreview, parseReleasePreview } from './preview';
export { fetchReleasePage, parseReleasePage, type FetchText } from './release';
export * from './requests';
export { fetchSupportersPage, parseSupportersPage } from './supporters';
export { FAN_PAGE_DOM } from './fanPageDom';
export { isOwnFanPage, parseViewer } from './viewer';
export {
  actionChange,
  FOLLOW_ACTION,
  fanProfileUrl,
  type PageAction,
  readBandHeader,
  WISHLIST_ACTION,
} from './pageActions';
export { parseViewedFanId } from './viewedFan';
export type * from './types';
