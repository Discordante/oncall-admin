import { useState, useEffect, useCallback } from "react";
import { Select } from "~/components/ui/Select";
import { api } from "~/lib/api";
import {
  endOfDayIso,
  endOfMonthDate,
  formatDate,
  formatDateTime,
  nowMillis,
  startOfDayIso,
  startOfMonthDate,
  toMillis,
} from "~/lib/format";
import type { components } from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DirectNumberInfo = components["schemas"]["DirectNumberInfo"];
type RedirectionInfo = components["schemas"]["RedirectionInfo"];
type ShiftRecord = components["schemas"]["ShiftResponse"];
type SipInfoResponse = components["schemas"]["SipInfoResponse"];
type CallRecordResponse = components["schemas"]["CallRecordResponse"];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
/** Format an international phone number: +XX XXX XXX XXX */
function formatPhoneNumber(raw?: string): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "—";
  const parts: string[] = [];
  let remaining = digits;
  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  parts.unshift(remaining);
  return `+${parts.join(" ")}`;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------
const dirNumStatusLabel: Record<string, string> = {
  on: "Activo",
  parking: "Aparcado",
  checking: "Verificando",
  checking_upload: "Verificando",
  reserved_on: "Reservado (activo)",
  reserved_checking: "Reservado (verificando)",
  reserved_checking_upload: "Reservado (verificando)",
};

const dirNumStatusColor: Record<string, string> = {
  on: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  parking: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  checking: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  checking_upload: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  reserved_on: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  reserved_checking: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  reserved_checking_upload: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

const redirStatusColor: Record<string, string> = {
  on: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  off: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ControlPanelTabProps {
  sipId?: string;
  groupId?: string;
  groupPeople?: { id?: string; name?: string; phoneNumber?: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ControlPanelTab({ sipId, groupId, groupPeople = [] }: ControlPanelTabProps) {
  const [sipFilter, setSipFilter] = useState(sipId ?? "");
  const [sips, setSips] = useState<SipInfoResponse[]>([]);
  const [loadingSips, setLoadingSips] = useState(!sipId);

  const [directNumbers, setDirectNumbers] = useState<DirectNumberInfo[]>([]);
  const [redirections, setRedirections] = useState<RedirectionInfo[]>([]);
  const [currentShift, setCurrentShift] = useState<ShiftRecord | null>(null);
  const [nextShift, setNextShift] = useState<ShiftRecord | null>(null);
  const [monthCalls, setMonthCalls] = useState<CallRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch SIPs when no sipId is provided ──
  useEffect(() => {
    if (sipId) {
      setLoadingSips(false);
      return;
    }
    async function fetchSips() {
      setLoadingSips(true);
      const { data, error: e } = await api.GET("/api/v1/zadarma/sips");
      if (!e && data?.data) setSips(data.data);
      setLoadingSips(false);
    }
    fetchSips();
  }, [sipId]);

  // ── Normalize phone numbers for comparison ──
  const groupPhoneNumbers = new Set(
    groupPeople
      .map((p) => p.phoneNumber)
      .filter(Boolean)
      .map((n) => n!.replace(/\D/g, ""))
  );

  const isGroupMemberNumber = (callerNumber?: string | null): boolean => {
    if (!callerNumber) return false;
    const fromStr = callerNumber.replace(/\D/g, "");
    for (const phone of groupPhoneNumbers) {
      if (phone && (fromStr.includes(phone) || phone.includes(fromStr))) return true;
    }
    return false;
  };

  // ── Fetch all panel data ──
  const fetchData = useCallback(async () => {
    if (!sipFilter) return;
    setLoading(true);
    setError(null);

    const nowMs = nowMillis();
    const fromISO = startOfDayIso(startOfMonthDate());
    const toISO = endOfDayIso(endOfMonthDate());

    const [directNumRes, redirRes, shiftsRes, callsRes] = await Promise.allSettled([
      api.GET("/api/v1/zadarma/direct-numbers"),
      api.GET("/api/v1/zadarma/sip-redirections", {
        params: { query: { id: sipFilter } },
      }),
      groupId
        ? api.GET("/api/v1/shifts", {
            params: { query: { onCallGroupId: groupId, from: fromISO, to: toISO } },
          })
        : Promise.resolve(null),
      api.GET("/api/v1/zadarma/calls-summary", {
        params: {
          query: {
            start: `${startOfMonthDate()} 00:00:00`,
            end: `${endOfMonthDate()} 23:59:59`,
            sip: sipFilter,
          },
        },
      }),
    ]);

    // Direct numbers
    if (directNumRes.status === "fulfilled") {
      const nums = directNumRes.value.data?.data?.info ?? [];
      // Filter to those linked to our SIP
      setDirectNumbers(sipFilter ? nums.filter((n) => n.sip === sipFilter) : nums);
    }

    // SIP redirections
    if (redirRes.status === "fulfilled") {
      setRedirections(redirRes.value.data?.data?.info ?? []);
    }

    // Current shift + next shift
    if (shiftsRes.status === "fulfilled" && shiftsRes.value) {
      const shifts = shiftsRes.value.data?.data ?? [];
      const sorted = [...shifts].sort(
        (a, b) => (toMillis(a.startTime) ?? 0) - (toMillis(b.startTime) ?? 0)
      );
      const active = sorted.find((s) => {
        const start = toMillis(s.startTime);
        const end = toMillis(s.endTime);
        if (start == null || end == null) return false;
        return nowMs >= start && nowMs < end;
      }) ?? null;
      setCurrentShift(active);

      // Find next shift that starts after the current one ends (or after now)
      const referenceTime = toMillis(active?.endTime) ?? nowMs;
      const next = sorted.find((s) => {
        const start = toMillis(s.startTime);
        return start != null && start >= referenceTime && s.id !== active?.id;
      }) ?? null;
      setNextShift(next);
    } else {
      setCurrentShift(null);
      setNextShift(null);
    }

    // Monthly calls (excluding group member test calls)
    if (callsRes.status === "fulfilled") {
      const allCalls = callsRes.value.data?.data ?? [];
      const realCalls = allCalls.filter((c) => !isGroupMemberNumber(c.callerNumber));
      setMonthCalls(realCalls);
    }

    setLoading(false);
  }, [sipFilter, groupId]);

  // Auto-fetch when sipFilter is set (on mount if sipId provided, otherwise on manual selection)
  useEffect(() => {
    if (sipFilter) {
      fetchData();
    }
  }, [fetchData]);

  // ── Stats ──
  const activeRedir = redirections.find((r) => r.status === "on");
  const nowMs = nowMillis();

  // ── Remaining time in current shift ──
  const remaining = (() => {
    const end = toMillis(currentShift?.endTime);
    if (end == null) return null;
    const diff = end - nowMs;
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h restantes`;
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m restantes`;
  })();

  // ── Date range string for current shift ──
  const dateRange = (() => {
    if (!currentShift?.startTime || !currentShift?.endTime) return null;
    return `${formatDate(currentShift.startTime)} → ${formatDate(currentShift.endTime)}`;
  })();

  // ── Numbers near expiry (within 15 days) ──
  const expiringNumbers = directNumbers.filter((n) => {
    if (n.status !== "on" || !n.stop_date) return false;
    const stop = toMillis(n.stop_date);
    if (stop == null) return false;
    const daysLeft = (stop - nowMs) / 86400000;
    return daysLeft >= 0 && daysLeft <= 15;
  });

  return (
    <div className="space-y-6">
      {/* ── SIP selector (only shown when group has no SIP configured) ── */}
      {!sipId && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Selecciona un SIP
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Este grupo no tiene un SIP configurado. Selecciona uno para ver el panel de control.
          </p>
          <div className="mt-4 w-full max-w-xs">
            <Select
              placeholder={loadingSips ? "Cargando SIPs..." : "Seleccionar SIP"}
              options={sips.map((s) => ({
                value: s.sipId ?? "",
                label: s.groupName ? `${s.sipId} — ${s.groupName}` : (s.sipId ?? ""),
              }))}
              value={sipFilter}
              onChange={(val) => setSipFilter(val)}
              disabled={loadingSips}
            />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="flex flex-col items-center py-12 text-sm text-gray-400">
          <svg className="mb-3 h-8 w-8 animate-spin text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p>Cargando panel de control...</p>
        </div>
      )}

      {/* ── No SIP selected state ── */}
      {!sipFilter && !loading && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-12 dark:border-gray-600 dark:bg-gray-900">
          <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 15V5.25m19.5 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.409A2.25 2.25 0 0 1 2.25 5.493V5.25" />
          </svg>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Selecciona un SIP para ver el panel de control
          </p>
        </div>
      )}

      {/* ── Dashboard content ── */}
      {sipFilter && !loading && (
        <>
          {/* ── Turno en curso ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Turno en curso</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Persona responsable ahora mismo</p>
              </div>
            </div>
            {currentShift ? (
              <div>
                <div className="flex flex-wrap gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Responsable</p>
                    <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
                      {currentShift.personName ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{currentShift.personEmail ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Horario</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                      {formatDateTime(currentShift.startTime)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(currentShift.endTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Vigencia</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                      {dateRange}
                    </p>
                    {remaining && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                        {remaining}
                      </p>
                    )}
                  </div>
                </div>
                {/* Next shift preview */}
                {nextShift && nextShift.personName && (
                  <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Siguiente guardia:{" "}
                      <span className="font-medium text-gray-600 dark:text-gray-300">{nextShift.personName}</span>
                      {" "}·{" "}
                      {nextShift.startTime && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatDate(nextShift.startTime)}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No hay ningún turno activo en este momento.</p>
            )}
          </div>

          {/* ── Llamadas del mes ── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Llamadas este mes</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{monthCalls.length}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Excluye comprobaciones internas</p>
                </div>
              </div>
            </div>

            {/* ── Reenvío SIP ── */}
            <div className={`rounded-xl border p-5 ${
              activeRedir
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${
                  activeRedir
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
                    : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                }`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M8.008 14.657l3.181-3.182" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Reenvío SIP</p>
                  <p className={`text-xl font-bold ${
                    activeRedir
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}>
                    {activeRedir ? "Activo" : "Inactivo"}
                  </p>
                  {activeRedir && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      → {activeRedir.destination_value ?? activeRedir.destination ?? "—"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Números virtuales activos ── */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-50 p-2.5 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V6.75a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6.75v1.5M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25M3 8.25h18" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Números activos</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {directNumbers.filter((n) => n.status === "on").length}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {directNumbers.length} total
                    {expiringNumbers.length > 0 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                        · {expiringNumbers.length} próximo{expiringNumbers.length > 1 ? "s" : ""} a caducar
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Números virtuales ── */}
          {directNumbers.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Números virtuales</h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Números directos asociados al SIP {sipFilter}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Número</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Nombre</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">País</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Estado</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Canales</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Renovación</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Caduca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {directNumbers.map((n, i) => (
                      <tr key={n.number ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {formatPhoneNumber(n.number)}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                          {n.number_name ?? n.description ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {n.country ?? "—"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${dirNumStatusColor[n.status ?? ""] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {dirNumStatusLabel[n.status ?? ""] ?? n.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center text-gray-600 dark:text-gray-400">
                          {n.channels ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {n.autorenew === "true" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Sí</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                          {n.stop_date ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {directNumbers.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-900">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No hay números virtuales asociados al SIP <span className="font-mono font-medium">{sipFilter}</span>.
              </p>
            </div>
          )}

          {/* ── Reenvíos SIP ── */}
          {redirections.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Configuración de reenvíos</h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Desvíos configurados para el SIP {sipFilter}
                    </p>
                  </div>
                  {activeRedir && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Reenvío activo → {activeRedir.destination_value ?? activeRedir.destination ?? "—"}
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">SIP</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Condición</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Destino</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Número / ID</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {redirections.map((r, i) => (
                      <tr key={r.sip_id ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 font-mono text-gray-900 dark:text-white whitespace-nowrap">
                          {r.sip_id ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 capitalize whitespace-nowrap">
                          {r.condition === "always" ? "Siempre" : r.condition === "unavailable" ? "No disponible" : (r.condition ?? "—")}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 capitalize whitespace-nowrap">
                          {r.destination === "phone" ? "Teléfono" : r.destination === "pbx" ? "Centralita virtual" : (r.destination ?? "—")}
                        </td>
                        <td className="px-6 py-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {r.destination_value ?? "—"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${redirStatusColor[r.status ?? ""] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {r.status === "on" ? "Activo" : r.status === "off" ? "Inactivo" : (r.status ?? "—")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {redirections.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-900">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No hay reenvíos configurados para el SIP <span className="font-mono font-medium">{sipFilter}</span>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
