export function snakeToCamel<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as T;
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = snakeToCamel(value);
    }
    return result as T;
  }
  return obj;
}
