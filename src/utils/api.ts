/** Normalize list endpoints that may return `{ results }` or a bare array. */
export function extractResults<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.results)) return data.results
  return []
}
