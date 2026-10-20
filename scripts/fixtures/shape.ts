// Structural comparison of JSON values: which key paths exist and which types they hold.
// Values are ignored, so fresh data with different content still compares equal.

export type Shape = Map<string, Set<string>>;

export interface ShapeDiff {
  removed: string[];
  added: string[];
  changed: { path: string; was: string[]; now: string[] }[];
}

// Bandcamp keys some objects by id (e.g. item_cache.collection["a123"]); fold those into one path.
const ID_KEY = /^[a-z]?\d{4,}(:[\w:]*)?$/i;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

function walk(value: unknown, path: string, shape: Shape): void {
  const types = shape.get(path) ?? new Set<string>();
  types.add(typeOf(value));
  shape.set(path, types);

  if (Array.isArray(value)) {
    for (const item of value) walk(item, `${path}[]`, shape);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walk(child, `${path}.${ID_KEY.test(key) ? '*' : key}`, shape);
    }
  }
}

export function shapeOf(value: unknown, root = '$'): Shape {
  const shape: Shape = new Map();
  walk(value, root, shape);
  return shape;
}

export function diffShapes(saved: Shape, fresh: Shape): ShapeDiff {
  const diff: ShapeDiff = { removed: [], added: [], changed: [] };
  for (const [path, was] of saved) {
    const now = fresh.get(path);
    if (!now) diff.removed.push(path);
    else if ([...was].sort().join() !== [...now].sort().join()) {
      diff.changed.push({ path, was: [...was].sort(), now: [...now].sort() });
    }
  }
  for (const path of fresh.keys()) if (!saved.has(path)) diff.added.push(path);
  return diff;
}

export function isSameShape(diff: ShapeDiff): boolean {
  return !diff.removed.length && !diff.added.length && !diff.changed.length;
}
