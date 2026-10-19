// String-based HTML extraction. The service worker has no DOMParser, so parsers work on raw HTML.

import { ParserError } from './errors';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function parseJson(raw: string, source: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ParserError(source, `invalid JSON (${String(error)})`);
  }
}

/** Reads `<… id="{id}" data-blob="…">` and returns the parsed JSON, or null if absent. */
export function readBlobById(html: string, id: string): unknown {
  const match = html.match(new RegExp(`id="${id}"[^>]*?\\sdata-blob="([^"]*)"`));
  return match?.[1] === undefined ? null : parseJson(decodeEntities(match[1]), `#${id}`);
}

/** Reads the first `data-{name}="…"` attribute as JSON, or null if absent. */
export function readDataAttribute(html: string, name: string): unknown {
  const match = html.match(new RegExp(`\\sdata-${name}="([^"]*)"`));
  return match?.[1] === undefined ? null : parseJson(decodeEntities(match[1]), `data-${name}`);
}

/** Reads the first ld+json script block, or null if absent. */
export function readLdJson(html: string): unknown {
  const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  return match?.[1] === undefined ? null : parseJson(match[1], 'ld+json');
}
