// ---------------------------------------------------------------------------
// Shared formatting helpers
// ---------------------------------------------------------------------------

/**
 * Formats total hours as "x días y x horas".
 * Zero parts are omitted: "5 días", "3 horas", or "1 día y 2 horas".
 * Rounds to the nearest whole hour.
 */
export function formatDuration(totalHours?: number): string {
  if (totalHours == null) return "—";
  const rounded = Math.round(totalHours);
  const days = Math.floor(rounded / 24);
  const hours = rounded % 24;

  if (days === 0) return `${hours} hora${hours === 1 ? "" : "s"}`;
  if (hours === 0) return `${days} día${days === 1 ? "" : "s"}`;
  return `${days} día${days === 1 ? "" : "s"} y ${hours} hora${hours === 1 ? "" : "s"}`;
}
