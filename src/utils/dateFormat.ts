/**
 * Compact timestamp format for admin log tables: 24-hour time (no AM/PM to save space)
 * followed by a short numeric date, e.g. "14:04 2/12/26". Always includes the year —
 * these tables can be paged back arbitrarily far with "Load More", so a bare month/day
 * would be ambiguous once entries are more than a year old.
 */
export function formatLogDateTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${hh}:${mm} ${d.getMonth() + 1}/${d.getDate()}/${yy}`;
}
