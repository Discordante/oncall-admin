import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { DateTime } from "luxon";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventContentArg } from "@fullcalendar/core";
import type { CalendarApi } from "@fullcalendar/core";
import type { DatesSetArg } from "@fullcalendar/core";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";
import { api } from "~/lib/api";
import {
  APP_TIMEZONE,
  endOfDayIso,
  formatDateTime,
  formatDuration,
  fromDateTimeLocal,
  startOfDayIso,
  toDateTimeLocal,
  toMillis,
} from "~/lib/format";
import type { components } from "~/lib/api";

// ---------------------------------------------------------------------------
// Timezone
// ---------------------------------------------------------------------------
const TZ = APP_TIMEZONE;

function getEventColorByIndex(index: number) {
  // Golden-angle distribution to avoid repeated hues in the visible set.
  const hue = Math.round((index * 137.508) % 360);
  return {
    bg: `hsl(${hue} 72% 45%)`,
    border: `hsl(${hue} 75% 33%)`,
    text: "#f8fafc",
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ShiftResponse = components["schemas"]["ShiftResponse"];
interface ShiftCalendarEvent {
  id?: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  classNames?: string[];
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    shift: ShiftResponse;
  };
}

/** Generic API error shape shared across all endpoints */
interface ApiErrorShape {
  errors?: { message?: string }[];
}

/** Extract a human-readable message from an openapi-fetch error object */
function getErrorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiErrorShape | undefined;
  return apiErr?.errors?.[0]?.message ?? fallback;
}

export interface ShiftManagerProps {
  groupId: string;
  people: { id?: string; name?: string; phoneNumber?: string }[];
}

// ---------------------------------------------------------------------------
// IconButton — icon-only button, consistent across all actions
// ---------------------------------------------------------------------------
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  /** Default "gray"; use "danger" for destructive, "primary" for edit */
  tone?: "gray" | "danger" | "primary";
}

const iconToneStyles: Record<string, string> = {
  gray: "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300",
  danger: "text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400",
  primary: "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, tone = "gray", className = "", ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`rounded p-1 transition-colors ${iconToneStyles[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";

// ---------------------------------------------------------------------------
// Shared input class (same as GroupForm)
// ---------------------------------------------------------------------------
const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

// ---------------------------------------------------------------------------
// Date helpers (Europe/Madrid timezone via luxon)
// ---------------------------------------------------------------------------

/** Convierte un datetime-local (en hora de Madrid) a ISO-8601 UTC */
function toIsoUtc(datetimeLocal: string): string {
  return fromDateTimeLocal(datetimeLocal) ?? "";
}

/** Convierte un ISO-8601 a formato datetime-local en hora de Madrid */
function toDatetimeLocal(iso?: string): string {
  return toDateTimeLocal(iso);
}

/** Obtiene una fecha YYYY-MM-DD desplazada n días desde hoy en Madrid */
function daysFromToday(n: number): string {
  return DateTime.now().setZone(TZ).plus({ days: n }).toFormat("yyyy-MM-dd");
}

function oneWeekAgo(): string {
  return daysFromToday(-7);
}

function fourWeeksAhead(): string {
  return daysFromToday(28);
}

function defaultShiftDateTimeLocal(daysOffset: number): string {
  return DateTime.now()
    .setZone(TZ)
    .plus({ days: daysOffset })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toFormat("yyyy-MM-dd'T'HH:mm");
}

type ShiftStatus = "activo" | "programado" | "realizado";

function getShiftStatus(startTime?: string, endTime?: string): ShiftStatus {
  if (!startTime || !endTime) return "realizado";
  const now = DateTime.now().setZone(TZ);
  const start = DateTime.fromISO(startTime, { zone: TZ });
  const end = DateTime.fromISO(endTime, { zone: TZ });
  if (now < start) return "programado";
  if (now > end) return "realizado";
  return "activo";
}

const statusBadge: Record<ShiftStatus, { label: string; cls: string; ping: boolean }> = {
  activo: {
    label: "En curso",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ping: true,
  },
  programado: {
    label: "Programado",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ping: false,
  },
  realizado: {
    label: "Completado",
    cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    ping: false,
  },
};

/** Duración de un turno usando el formateo compartido "x días y x horas" */
function formatShiftDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return "—";
  const start = DateTime.fromISO(startTime, { zone: TZ });
  const end = DateTime.fromISO(endTime, { zone: TZ });
  if (!start.isValid || !end.isValid || end <= start) return "—";

  return formatDuration(end.diff(start, "hours").hours);
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------
interface OverlapInfo {
  shift: ShiftResponse;
  /** true si el nuevo turno contiene completamente a este turno existente */
  engulfed: boolean;
}

function findOverlappingShifts(
  newStartIso: string,
  newEndIso: string,
  existingShifts: ShiftResponse[],
  excludeShiftId?: string,
): OverlapInfo[] {
  const start = toMillis(newStartIso) ?? 0;
  const end = toMillis(newEndIso) ?? 0;

  return existingShifts
    .filter((s) => {
      if (excludeShiftId && s.id === excludeShiftId) return false;
      const sStart = toMillis(s.startTime) ?? 0;
      const sEnd = toMillis(s.endTime) ?? 0;
      // Hay solapamiento si: newStart < sEnd AND newEnd > sStart
      return start < sEnd && end > sStart;
    })
    .map((s) => {
      const sStart = toMillis(s.startTime) ?? 0;
      const sEnd = toMillis(s.endTime) ?? 0;
      return {
        shift: s,
        engulfed: start <= sStart && end >= sEnd,
      };
    });
}

interface ConfirmState {
  mode: "create" | "edit";
  startTime: string; // ISO
  endTime: string;   // ISO
  personId: string;
  personName: string;
  overlapping: OverlapInfo[];
  /** solo para edición */
  editShiftId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ShiftManager({ groupId, people }: ShiftManagerProps) {
  // ── Filter state ──
  const [dateFrom, setDateFrom] = useState(oneWeekAgo);
  const [dateTo, setDateTo] = useState(fourWeeksAhead);

  // ── Data state ──
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // ── Create form state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newPersonId, setNewPersonId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Edit state ──
  const [editingShift, setEditingShift] = useState<ShiftResponse | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPersonId, setEditPersonId] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Confirmation modal state ──
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);

  // ── Load shifts ──
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fromIso = dateFrom ? startOfDayIso(dateFrom) : undefined;
    const toIso = dateTo ? endOfDayIso(dateTo) : undefined;

    const { data, error: apiError } = await api.GET("/api/v1/shifts", {
      params: {
        query: {
          onCallGroupId: groupId,
          from: fromIso,
          to: toIso,
        },
      },
    });

    if (apiError) {
      setError(getErrorMessage(apiError, "Error al cargar turnos"));
      setShifts([]);
    } else {
      const list = data?.data ?? [];
      list.sort((a, b) => {
        const aTime = toMillis(a.startTime) ?? 0;
        const bTime = toMillis(b.startTime) ?? 0;
        return aTime - bTime;
      });
      setShifts(list);
    }

    setLoading(false);
  }, [groupId, dateFrom, dateTo]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // ── Create shift (shows confirmation modal) ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newStart || !newEnd || !newPersonId) {
      setCreateError("Completa todos los campos");
      return;
    }

    if (newStart >= newEnd) {
      setCreateError("La fecha de fin debe ser posterior a la de inicio");
      return;
    }

    const startIso = toIsoUtc(newStart);
    const endIso = toIsoUtc(newEnd);
    const personName = activePeople.find((p) => p.id === newPersonId)?.name ?? newPersonId;
    const overlapping = findOverlappingShifts(startIso, endIso, shifts);

    setConfirmState({
      mode: "create",
      startTime: startIso,
      endTime: endIso,
      personId: newPersonId,
      personName,
      overlapping,
    });
    setConfirmError(null);
  };

  // ── Start editing a shift ──
  const handleStartEdit = (shift: ShiftResponse) => {
    setEditingShift(shift);
    setEditStart(toDatetimeLocal(shift.startTime));
    setEditEnd(toDatetimeLocal(shift.endTime));
    setEditPersonId(shift.personId ?? "");
    setEditError(null);
    // Close create form if open
    setShowCreateForm(false);
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditStart("");
    setEditEnd("");
    setEditPersonId("");
    setEditError(null);
  };

  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
    setCreateError(null);
    setNewStart("");
    setNewEnd("");
    setNewPersonId("");
  };

  const handleOpenCreateForm = () => {
    setShowCreateForm(true);
    setCreateError(null);
    setNewStart(defaultShiftDateTimeLocal(0));
    setNewEnd(defaultShiftDateTimeLocal(1));
    setNewPersonId("");
  };

  const handleCloseShiftFormModal = useCallback(() => {
    if (editingShift) {
      handleCancelEdit();
    } else {
      handleCloseCreateForm();
    }
  }, [editingShift]);

  // ── Update shift (shows confirmation modal) ──
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    setEditError(null);

    if (!editStart || !editEnd || !editPersonId) {
      setEditError("Completa todos los campos");
      return;
    }

    if (editStart >= editEnd) {
      setEditError("La fecha de fin debe ser posterior a la de inicio");
      return;
    }

    const startIso = toIsoUtc(editStart);
    const endIso = toIsoUtc(editEnd);
    const personName = activePeople.find((p) => p.id === editPersonId)?.name ?? editPersonId;
    const overlapping = findOverlappingShifts(startIso, endIso, shifts, editingShift.id);

    setConfirmState({
      mode: "edit",
      startTime: startIso,
      endTime: endIso,
      personId: editPersonId,
      personName,
      overlapping,
      editShiftId: editingShift.id,
    });
    setConfirmError(null);
  };

  // ── Confirm: actually create the shift ──
  const handleConfirmCreate = async () => {
    if (!confirmState) return;
    setConfirming(true);
    setConfirmError(null);

    const { error: apiError } = await api.POST("/api/v1/shifts", {
      body: {
        startTime: confirmState.startTime,
        endTime: confirmState.endTime,
        onCallGroupId: groupId,
        personId: confirmState.personId,
      },
    });

    if (apiError) {
      setConfirmError(getErrorMessage(apiError, "Error al crear el turno"));
    } else {
      setNewStart("");
      setNewEnd("");
      setNewPersonId("");
      setShowCreateForm(false);
      setConfirmState(null);
      setConfirmError(null);
      fetchShifts();
    }

    setConfirming(false);
  };

  // ── Confirm: actually update the shift ──
  const handleConfirmUpdate = async () => {
    if (!confirmState || !confirmState.editShiftId) return;
    setConfirming(true);
    setConfirmError(null);

    const { error: apiError } = await api.PUT("/api/v1/shifts/{id}", {
      params: { path: { id: confirmState.editShiftId } },
      body: {
        startTime: confirmState.startTime,
        endTime: confirmState.endTime,
        onCallGroupId: groupId,
        personId: confirmState.personId,
      },
    });

    if (apiError) {
      setConfirmError(getErrorMessage(apiError, "Error al actualizar el turno"));
    } else {
      handleCancelEdit();
      setConfirmState(null);
      setConfirmError(null);
      fetchShifts();
    }

    setConfirming(false);
  };
  const handleDelete = async (shift: ShiftResponse) => {
    if (!window.confirm(`¿Eliminar el turno de "${shift.personName}"?\n${formatRange(shift.startTime, shift.endTime)}`)) {
      return;
    }

    const { error: apiError } = await api.DELETE("/api/v1/shifts/{id}", {
      params: { path: { id: shift.id! } },
    });

    if (apiError) {
      alert("Error al eliminar el turno");
    } else {
      fetchShifts();
    }
  };

  // ── Generate shifts ──
  const handleGenerate = async () => {
    if (!window.confirm("¿Generar turnos automáticamente para este grupo? Se asignarán a las personas con menos horas acumuladas.")) {
      return;
    }

    setGenerating(true);
    setGenerateResult(null);
    setError(null);

    const { data, error: apiError } = await api.POST("/api/v1/on-call-groups/{id}/generate-shifts", {
      params: { path: { id: groupId } },
    });

    if (apiError) {
      setError(getErrorMessage(apiError, "Error al generar turnos"));
    } else {
      const result = data?.data;
      const count = result?.createdShifts?.length ?? 0;
      const from = result?.coverageStart ? formatDate(result.coverageStart) : "?";
      const to = result?.coverageEnd ? formatDate(result.coverageEnd) : "?";
      setGenerateResult(`Se generaron ${count} turnos cubriendo del ${from} al ${to}.`);
      fetchShifts();
    }

    setGenerating(false);
  };

  // ── Render helpers ──
  const formatDate = (iso?: string) => formatDateTime(iso);

  const formatRange = (start?: string, end?: string) =>
    `${formatDate(start)} → ${formatDate(end)}`;

  const activePeople = people.filter((p) => p.id && p.name);

  const personColorMap = useMemo(() => {
    const keys = Array.from(
      new Set(
        shifts.map((shift) => shift.personId ?? shift.personName ?? "sin-persona"),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const map = new Map<string, { bg: string; border: string; text: string }>();
    keys.forEach((key, index) => {
      map.set(key, getEventColorByIndex(index));
    });

    return map;
  }, [shifts]);

  const shiftCalendarEvents = useMemo<ShiftCalendarEvent[]>(() => {
    interface DayCandidate {
      personKey: string;
      personName: string;
      hours: number;
      shift: ShiftResponse;
    }

    const dayCandidates = new Map<string, DayCandidate[]>();

    shifts.forEach((shift) => {
      const start = shift.startTime
        ? DateTime.fromISO(shift.startTime, { setZone: true }).setZone(TZ)
        : null;
      const end = shift.endTime
        ? DateTime.fromISO(shift.endTime, { setZone: true }).setZone(TZ)
        : null;

      if (!start?.isValid || !end?.isValid || end <= start) {
        return;
      }

      const personKey = shift.personId ?? shift.personName ?? "sin-persona";
      const personName = shift.personName ?? "Sin persona";
      let cursor = start.startOf("day");
      const lastDay = end.startOf("day");

      while (cursor <= lastDay) {
        const dayStart = cursor;
        const dayEnd = cursor.plus({ days: 1 });
        const overlapStart = start > dayStart ? start : dayStart;
        const overlapEnd = end < dayEnd ? end : dayEnd;
        const hours = overlapEnd.diff(overlapStart, "hours").hours;
        const dayKey = dayStart.toISODate();

        if (dayKey && hours > 0) {
          const list = dayCandidates.get(dayKey) ?? [];
          list.push({ personKey, personName, hours, shift });
          dayCandidates.set(dayKey, list);
        }

        cursor = cursor.plus({ days: 1 });
      }
    });

    const dayOwner = new Map<string, DayCandidate>();
    dayCandidates.forEach((candidates, dayKey) => {
      const selected = [...candidates].sort((a, b) => {
        if (b.hours !== a.hours) return b.hours - a.hours;
        return a.personName.localeCompare(b.personName);
      })[0];
      if (selected) {
        dayOwner.set(dayKey, selected);
      }
    });

    const sortedDays = Array.from(dayOwner.keys()).sort((a, b) => a.localeCompare(b));
    const events: ShiftCalendarEvent[] = [];
    const todayStart = DateTime.now().setZone(TZ).startOf("day");

    let runStart: string | null = null;
    let runEnd: string | null = null;
    let runOwner: DayCandidate | null = null;

    const pushRun = () => {
      if (!runStart || !runEnd || !runOwner) return;

      const endExclusive = DateTime.fromISO(runEnd, { zone: TZ }).plus({ days: 1 }).toISODate();
      if (!endExclusive) return;

      const eventLastDayEnd = DateTime.fromISO(runEnd, { zone: TZ }).endOf("day");
      const isPastEvent = eventLastDayEnd < todayStart;

      const fallbackIndex = personColorMap.size;
      const color = personColorMap.get(runOwner.personKey) ?? getEventColorByIndex(fallbackIndex);

      events.push({
        id: `${runOwner.personKey}-${runStart}-${runEnd}`,
        title: runOwner.personName,
        start: runStart,
        end: endExclusive,
        allDay: true,
        classNames: isPastEvent ? ["fc-shift-past"] : undefined,
        backgroundColor: color.bg,
        borderColor: color.border,
        textColor: color.text,
        extendedProps: {
          shift: runOwner.shift,
        },
      });
    };

    sortedDays.forEach((dayKey) => {
      const owner = dayOwner.get(dayKey);
      if (!owner) return;

      if (!runStart || !runEnd || !runOwner) {
        runStart = dayKey;
        runEnd = dayKey;
        runOwner = owner;
        return;
      }

      const expectedNext = DateTime.fromISO(runEnd, { zone: TZ }).plus({ days: 1 }).toISODate();
      const sameOwner = runOwner.personKey === owner.personKey;

      if (sameOwner && expectedNext === dayKey) {
        runEnd = dayKey;
      } else {
        pushRun();
        runStart = dayKey;
        runEnd = dayKey;
        runOwner = owner;
      }
    });

    pushRun();

    return events;
  }, [shifts, personColorMap]);

  const calendarInitialDate = useMemo(() => {
    const rangeFrom = dateFrom
      ? DateTime.fromISO(dateFrom, { zone: TZ }).startOf("day")
      : null;
    return (rangeFrom?.isValid ? rangeFrom : DateTime.now().setZone(TZ)).toISODate() ?? undefined;
  }, [dateFrom]);

  const calendarMonthTitle = useMemo(() => {
    const from = DateTime.fromISO(dateFrom, { zone: TZ });
    const base = (from.isValid ? from : DateTime.now().setZone(TZ)).setLocale("es");
    return base.toFormat("LLLL 'de' yyyy");
  }, [dateFrom]);

  useEffect(() => {
    const api = calendarRef.current?.getApi() as CalendarApi | undefined;
    if (!api || !calendarInitialDate) return;
    api.gotoDate(calendarInitialDate);
  }, [calendarInitialDate]);

  const handleCalendarDatesSet = useCallback((arg: DatesSetArg) => {
    const nextFrom = DateTime.fromJSDate(arg.view.currentStart, { zone: TZ }).toISODate();
    const nextTo = DateTime.fromJSDate(arg.view.currentEnd, { zone: TZ }).minus({ days: 1 }).toISODate();

    if (!nextFrom || !nextTo) return;

    setDateFrom((prev) => (prev === nextFrom ? prev : nextFrom));
    setDateTo((prev) => (prev === nextTo ? prev : nextTo));
  }, []);

  const handleCalendarNav = (action: "prev" | "next" | "today") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (action === "prev") {
      api.prev();
      return;
    }

    if (action === "next") {
      api.next();
      return;
    }

    api.today();
  };

  useEffect(() => {
    const isShiftFormModalOpen = showCreateForm || Boolean(editingShift);
    if (!isShiftFormModalOpen || confirmState) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseShiftFormModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreateForm, editingShift, confirmState, handleCloseShiftFormModal]);

  const renderCalendarEvent = useCallback((arg: EventContentArg) => {
    return (
      <span className="fc-shift-event-title">
        {arg.event.title}
      </span>
    );
  }, []);

  // ── Shared form fields for create & edit (single-column layout) ──
  const peopleOptions = activePeople.map((p) => ({
    value: p.id!,
    label: p.phoneNumber ? (p.name ?? "") : `${p.name ?? ""} — sin teléfono`,
    disabled: !p.phoneNumber,
  }));

  const renderShiftForm = (
    startVal: string,
    endVal: string,
    personVal: string,
    onStartChange: (v: string) => void,
    onEndChange: (v: string) => void,
    onPersonChange: (v: string) => void,
    formError: string | null,
    isSubmitting: boolean,
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string,
  ) => (
    <form onSubmit={onSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {formError}
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Inicio *
          </label>
          <input
            type="datetime-local"
            value={startVal}
            onChange={(e) => onStartChange(e.target.value)}
            className={inputCls + " w-full"}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Fin *
          </label>
          <input
            type="datetime-local"
            value={endVal}
            onChange={(e) => onEndChange(e.target.value)}
            className={inputCls + " w-full"}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Persona *
          </label>
          {activePeople.length === 0 ? (
            <p className="text-sm text-gray-400">
              Sin personas. Añádelas en Información.
            </p>
          ) : (
            <div className="w-full">
              <Select
                placeholder="Seleccionar..."
                options={peopleOptions}
                value={personVal || undefined}
                onChange={(val) => onPersonChange(val)}
              />
            </div>
          )}
        </div>
        <div className="pt-1">
          <Button type="submit" variant="primary" size="md" loading={isSubmitting} disabled={activePeople.length === 0}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* ── Date range filter ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Filtrar turnos
        </h3>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="shift-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Desde
            </label>
            <input
              id="shift-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="shift-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </label>
            <input
              id="shift-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <Button type="button" variant="secondary" size="md" loading={loading} onClick={fetchShifts}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Filtrar
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Generate result (dismissible) ── */}
      {generateResult && (
        <div className="flex items-start justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          <span>{generateResult}</span>
          <IconButton label="Cerrar" tone="gray" onClick={() => setGenerateResult(null)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* ── Shifts table ── */}
        <div className="rounded-xl border border-gray-200 bg-white xl:col-span-7 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Turnos {shifts.length > 0 && <span className="font-normal text-gray-400">({shifts.length})</span>}
            </h3>
            <div className="flex items-center gap-2">
              {!showCreateForm && !editingShift && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCreateForm}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Añadir turno
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={generating}
                onClick={handleGenerate}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                Generar automáticamente
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando turnos...
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-sm text-gray-400">
              <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              No hay turnos en este período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Persona</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Inicio</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Fin</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Tiempo</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 w-24">Estado</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {shifts.map((shift) => {
                    const status = getShiftStatus(shift.startTime, shift.endTime);
                    const badge = statusBadge[status];
                    return (
                      <tr
                        key={shift.id}
                        className={`group hover:bg-gray-50 dark:hover:bg-gray-800/50 ${status === "activo" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                      >
                        <td className="px-6 py-3 text-gray-900 dark:text-white">
                          {shift.personName ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                          {formatDate(shift.startTime)}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                          {formatDate(shift.endTime)}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                          {formatShiftDuration(shift.startTime, shift.endTime)}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                            {badge.ping && (
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                              </span>
                            )}
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {status !== "realizado" && (
                            <div className="flex items-center gap-0.5">
                              <IconButton label="Editar turno" tone="primary" onClick={() => handleStartEdit(shift)}>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </IconButton>
                              <IconButton label="Eliminar turno" tone="danger" onClick={() => handleDelete(shift)}>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </IconButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Visual calendar ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 xl:col-span-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Calendario de turnos</h3>
            <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => handleCalendarNav("prev")}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <h4 className="min-w-52 text-center text-2xl font-semibold capitalize text-gray-900 dark:text-white">
                  {calendarMonthTitle}
                </h4>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => handleCalendarNav("next")}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
            </div>
          </div>
          <div className="shift-calendar min-h-[680px]">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin]}
              locale={esLocale}
              initialView="dayGridMonth"
              initialDate={calendarInitialDate}
              firstDay={1}
              height="auto"
              fixedWeekCount
              showNonCurrentDates
              displayEventTime={false}
              eventDisplay="block"
              dayMaxEventRows={3}
              headerToolbar={false}
              datesSet={handleCalendarDatesSet}
              events={shiftCalendarEvents}
              eventContent={renderCalendarEvent}
              eventClick={(info) => {
                const shift = info.event.extendedProps.shift as ShiftResponse | undefined;
                if (!shift) return;
                if (getShiftStatus(shift.startTime, shift.endTime) !== "realizado") {
                  handleStartEdit(shift);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Create/Edit shift modal ── */}
      {(showCreateForm || editingShift) && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseShiftFormModal();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingShift ? `Editar turno - ${editingShift.personName ?? "Sin persona"}` : "Añadir turno"}
              </h3>
              <IconButton
                label="Cerrar formulario"
                onClick={handleCloseShiftFormModal}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
            <div className="px-6 py-5">
              {editingShift
                ? renderShiftForm(
                    editStart,
                    editEnd,
                    editPersonId,
                    setEditStart,
                    setEditEnd,
                    setEditPersonId,
                    editError,
                    updating,
                    handleUpdate,
                    "Guardar cambios",
                  )
                : renderShiftForm(
                    newStart,
                    newEnd,
                    newPersonId,
                    setNewStart,
                    setNewEnd,
                    setNewPersonId,
                    createError,
                    creating,
                    handleCreate,
                    "Añadir turno",
                  )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {confirmState.mode === "create" ? "Confirmar creación de turno" : "Confirmar edición de turno"}
              </h3>
              <IconButton
                label="Cerrar"
                onClick={() => {
                  setConfirmState(null);
                  setConfirmError(null);
                }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-4">
              {/* Summary of the shift being created/edited */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Resumen del turno
                </h4>
                <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Persona:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{confirmState.personName}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Inicio:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(confirmState.startTime)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Fin:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(confirmState.endTime)}</span>
                  </div>
                </div>
              </div>

              {/* Overlap impact warning */}
              {confirmState.overlapping.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      ¡Atención! Este turno solapa con {confirmState.overlapping.length} turno{confirmState.overlapping.length > 1 ? "s" : ""} existente{confirmState.overlapping.length > 1 ? "s" : ""}
                    </h4>
                  </div>
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                    {confirmState.mode === "create"
                      ? "Al crear este turno, los siguientes turnos serán <strong>eliminados automáticamente</strong> por el sistema:"
                      : "Al guardar los cambios, los siguientes turnos serán <strong>eliminados automáticamente</strong> por el sistema:"}
                  </p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {confirmState.overlapping.map((oi) => (
                      <div
                        key={oi.shift.id}
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
                      >
                        {oi.engulfed ? (
                          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6m0-6l-6 6" />
                          </svg>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {oi.shift.personName ?? "—"}
                          </span>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">
                            {formatRange(oi.shift.startTime, oi.shift.endTime)}
                          </span>
                          {oi.engulfed && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                              Eliminado por completo
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <span>Ningún turno existente se verá afectado por esta operación.</span>
                </div>
              )}

              {/* Error */}
              {confirmError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {confirmError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={confirming}
                onClick={() => {
                  setConfirmState(null);
                  setConfirmError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={confirming}
                onClick={() => {
                  if (confirmState.mode === "create") {
                    handleConfirmCreate();
                  } else {
                    handleConfirmUpdate();
                  }
                }}
              >
                {confirmState.mode === "create" ? "Crear turno" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
