import type { z } from 'zod';
import { BandcampApiError, ParserError } from './errors';

/** Validates `data` against `schema`, turning failures into a ParserError that names the field. */
export function validate<S extends z.ZodType>(
  schema: S,
  data: unknown,
  source: string,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.join('.') || '(root)';
  throw new ParserError(source, `unexpected shape at ${path}: ${issue?.message ?? 'invalid'}`);
}

/** Throws BandcampApiError for Bandcamp's HTTP-200 `{"error": true}` responses. */
export function assertNotApiError<T extends object>(
  data: T,
  source: string,
): Exclude<T, { error: true }> {
  if ('error' in data && data.error === true) throw new BandcampApiError(source);
  return data as Exclude<T, { error: true }>;
}
