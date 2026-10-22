import selectCss from './CardSelect.css?inline';
import { tagBarStyles, tagEditorStyles } from '../shared/tagStyles';
import featureCss from './Following.css?inline';

/** Feature CSS for every shadow root on the following tab: the bar, each card, the app root. */
export const followingCss = tagEditorStyles + tagBarStyles + featureCss;

/** The select box gets a shadow root of its own, over the card's avatar. */
export const cardSelectCss = selectCss;
