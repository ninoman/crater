// Pulls the structured blobs out of a fixture body, so HTML pages compare by their data, not markup.

import { readBlobById, readDataAttribute, readLdJson } from '../../src/bandcamp/html';
import { shapeOf, type Shape } from './shape';

const BLOBS: [name: string, read: (html: string) => unknown][] = [
  ['data-tralbum', (html) => readDataAttribute(html, 'tralbum')],
  ['#pagedata', (html) => readBlobById(html, 'pagedata')],
  ['#collectors-data', (html) => readBlobById(html, 'collectors-data')],
  ['ld+json', readLdJson],
];

/** One shape per blob present. A blob that exists in only one side shows up as removed/added. */
export function shapeOfBody(file: string, body: string): Shape {
  if (file.endsWith('.json')) return shapeOf(JSON.parse(body));

  const shape: Shape = new Map();
  for (const [name, read] of BLOBS) {
    const value = read(body);
    if (value === null) continue;
    for (const [path, types] of shapeOf(value, name)) shape.set(path, types);
  }
  return shape;
}
