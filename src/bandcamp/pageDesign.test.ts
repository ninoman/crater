import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { parsePageDesign } from './pageDesign';

function designHtml(design: object): string {
  const escaped = JSON.stringify(design).replaceAll('"', '&quot;');
  return `<style type="text/css" id="custom-design-rules-style" data-design="${escaped}"></style>`;
}

describe('parsePageDesign', () => {
  it('reads a dark design', () => {
    expect(parsePageDesign(fixtureText('album-page.html'))).toEqual({
      background: '#000000',
      text: '#ffffff',
      secondaryText: '#888888',
      link: '#8cb8de',
    });
  });

  it('takes the content column colour, not the page background', () => {
    expect(parsePageDesign(fixtureText('album-page-small.html'))).toEqual({
      background: '#2a447e',
      text: '#84bee6',
      secondaryText: '#ffffff',
      link: '#a9c7df',
    });
  });

  it('returns null without a design or with an unreadable colour', () => {
    expect(parsePageDesign('<html></html>')).toBeNull();
    const design = {
      body_color: '000000',
      text_color: 'white',
      secondary_text_color: '888888',
      link_color: '8CB8DE',
    };
    expect(parsePageDesign(designHtml(design))).toBeNull();
    expect(parsePageDesign(designHtml({ ...design, text_color: null }))).toBeNull();
  });

  it('returns null for broken JSON', () => {
    expect(
      parsePageDesign('<style id="custom-design-rules-style" data-design="{oops"></style>'),
    ).toBeNull();
  });
});
