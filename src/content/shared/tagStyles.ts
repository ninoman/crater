import pageTagsCss from './PageTags.css?inline';
import tagBarCss from './TagBar.css?inline';
import tagEditorCss from './TagEditor.css?inline';

/** Styles for `TagEditor` in any shadow root that hosts one. */
export const tagEditorStyles = tagEditorCss;

/** Styles for the tags on a page of their own (`FollowedAccountTags`, `WishlistItemTags`). */
export const pageTagsStyles = tagEditorCss + pageTagsCss;

/** Styles for a tagged list's filter bar and bulk bar. */
export const tagBarStyles = tagBarCss;
