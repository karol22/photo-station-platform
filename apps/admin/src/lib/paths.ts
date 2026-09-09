/** Lectura y escritura inmutable por rutas con punto (`address.city`, `camera.resolution.width`). */

export function getPath(target: unknown, path: string): unknown {
  if (target === null || target === undefined) return undefined;
  let current: unknown = target;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function setPath<T extends Record<string, unknown>>(target: T, path: string, value: unknown): T {
  const segments = path.split('.');
  const clone = (obj: unknown): Record<string, unknown> =>
    obj !== null && typeof obj === 'object' && !Array.isArray(obj) ? { ...(obj as Record<string, unknown>) } : {};
  const root = clone(target);
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i] as string;
    const next = clone(cursor[segment]);
    cursor[segment] = next;
    cursor = next;
  }
  const last = segments[segments.length - 1] as string;
  if (value === undefined) delete cursor[last];
  else cursor[last] = value;
  return root as T;
}

/** Claves de primer nivel cuyo valor difiere (comparación estructural por JSON estable). */
export function changedTopLevelKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const key of keys) {
    if (stable(before[key]) !== stable(after[key])) out.push(key);
  }
  return out;
}

export function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) sorted[key] = (v as Record<string, unknown>)[key];
      return sorted;
    }
    return v;
  });
}

/** Subconjunto de `after` con las claves de primer nivel que cambian respecto a `before`. */
export function diffPatch(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of changedTopLevelKeys(before, after)) patch[key] = after[key] === undefined ? null : after[key];
  return patch;
}
