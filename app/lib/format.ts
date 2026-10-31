import { DateTime } from "luxon";

// ---------------------------------------------------------------------------
// Shared formatting helpers
// ---------------------------------------------------------------------------

/** Single source of truth for the application timezone. */
export const APP_TIMEZONE = "Europe/Madrid";

/**
 * Parses an ISO-8601 string (with offset) or the legacy Zadarma
 * "yyyy-MM-dd HH:mm:ss" format (interpreted in the app timezone) and returns
 * a Luxon DateTime already converted to the app timezone.
 */
export function parseAppDateTime(raw?: string | null): DateTime | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const dt = value.includes("T")
    ? DateTime.fromISO(value, { setZone: true })
    : DateTime.fromFormat(value, "yyyy-MM-dd HH:mm:ss", { zone: APP_TIMEZONE });

  return dt.isValid ? dt.setZone(APP_TIMEZONE) : null;
}

/** "dd/MM/yyyy HH:mm" in the app timezone. */
export function formatDateTime(iso?: string | null): string {
  return parseAppDateTime(iso)?.toFormat("dd/MM/yyyy HH:mm") ?? "—";
}

/** "dd/MM/yyyy" in the app timezone. */
export function formatDate(iso?: string | null): string {
  return parseAppDateTime(iso)?.toFormat("dd/MM/yyyy") ?? "—";
}

/** "yyyy-MM-dd'T'HH:mm" for datetime-local inputs (app timezone). */
export function toDateTimeLocal(iso?: string | null): string {
  return parseAppDateTime(iso)?.toFormat("yyyy-MM-dd'T'HH:mm") ?? "";
}

/** Converts a datetime-local value (app timezone) to a UTC ISO instant. */
export function fromDateTimeLocal(value?: string | null): string | undefined {
  if (!value) return undefined;
  const dt = DateTime.fromISO(value, { zone: APP_TIMEZONE });
  return dt.isValid ? (dt.toUTC().toISO() ?? undefined) : undefined;
}

/** Today's date as "yyyy-MM-dd" in the app timezone. */
export function todayDate(): string {
  return DateTime.now().setZone(APP_TIMEZONE).toFormat("yyyy-MM-dd");
}

/** First day of the current month as "yyyy-MM-dd" in the app timezone. */
export function startOfMonthDate(): string {
  return DateTime.now().setZone(APP_TIMEZONE).startOf("month").toFormat("yyyy-MM-dd");
}

/** Last day of the current month as "yyyy-MM-dd" in the app timezone. */
export function endOfMonthDate(): string {
  return DateTime.now().setZone(APP_TIMEZONE).endOf("month").toFormat("yyyy-MM-dd");
}

/** UTC ISO instant for the start of a "yyyy-MM-dd" date in the app timezone. */
export function startOfDayIso(date: string): string | undefined {
  const dt = DateTime.fromISO(date, { zone: APP_TIMEZONE }).startOf("day");
  return dt.isValid ? (dt.toUTC().toISO() ?? undefined) : undefined;
}

/** UTC ISO instant for the end of a "yyyy-MM-dd" date in the app timezone. */
export function endOfDayIso(date: string): string | undefined {
  const dt = DateTime.fromISO(date, { zone: APP_TIMEZONE }).endOf("day");
  return dt.isValid ? (dt.toUTC().toISO() ?? undefined) : undefined;
}

/** Epoch millis for any supported date string. */
export function toMillis(raw?: string | null): number | null {
  return parseAppDateTime(raw)?.toMillis() ?? null;
}

/** Current epoch millis. */
export function nowMillis(): number {
  return DateTime.now().toMillis();
}

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
