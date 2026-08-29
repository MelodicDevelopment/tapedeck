/**
 * Marks an array item with a stable key so Melodic's template renderer reuses
 * its DOM across renders instead of tearing the whole array down and
 * rebuilding it (which reloads every <img> inside — a visible blink).
 *
 * This targets the renderer's keyed-array protocol (`__keyed` items, see
 * TemplateResult.getKeyedValues in @melodicdev/core). Unlike `repeat()` it is
 * a plain value, so it's safe inside conditionally-rendered sub-templates.
 */
export function keyed<T>(key: string, value: T): T {
  return { __keyed: true, key, value } as unknown as T
}
