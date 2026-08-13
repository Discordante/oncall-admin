import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";
import { api } from "~/lib/api";
import type { components } from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ZadarmaStatsResponse = components["schemas"]["ZadarmaStatsResponse"];
type ZadarmaCallRecord = components["schemas"]["ZadarmaCallRecord"];
type SipInfoResponse = components["schemas"]["SipInfoResponse"];
type ShiftRecord = components["schemas"]["ShiftResponse"];

/** Generic API error shape */
interface ApiErrorShape {
  errors?: { message?: string }[];
}

function getErrorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiErrorShape | undefined;
  return apiErr?.errors?.[0]?.message ?? fallback;
}

// ---------------------------------------------------------------------------
// Shared input class (same pattern as BillingTab)
// ---------------------------------------------------------------------------
const inputCls =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

/** First day of current month as YYYY-MM-DD */
function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Last day of current month as YYYY-MM-DD */
function endOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatDateTime(raw?: string): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw.replace(" ", "T"));
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

function formatDuration(billseconds?: number): string {
  if (billseconds == null) return "—";
  const mins = Math.floor(billseconds / 60);
  const secs = billseconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatPhone(num?: number): string {
  if (num == null) return "—";
  const digits = String(num).replace(/\D/g, "");
  if (!digits) return "—";
  // Group from right in chunks of 3, prefix with +
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
// Disposition badge colors
// ---------------------------------------------------------------------------
const dispositionBadge: Record<string, string> = {
  answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  busy: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancel: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  "no answer": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "no money": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "unallocated number": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  "no limit": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "no day limit": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "line limit": "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "no money, no limit": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

function formatDisposition(disp?: string): ReactNode {
  if (!disp) return "—";
  const map: Record<string, string> = {
    answered: "Atendida",
    busy: "Ocupado",
    cancel: "Cancelada",
    "no answer": "Sin respuesta",
    failed: "Fallida",
    "no money": "Sin saldo",
    "unallocated number": "Nº no asignado",
    "no limit": "Sin límite",
    "no day limit": "Límite diario",
    "line limit": "Límite de línea",
    "no money, no limit": "Sin saldo/límite",
  };
  const label = map[disp] ?? disp;
  const badgeCls = dispositionBadge[disp] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CallsSummaryTabProps {
  sipId?: string;
  groupId?: string;
  groupPeople?: { id?: string; name?: string; phoneNumber?: string }[];
}

export function CallsSummaryTab({ sipId, groupId, groupPeople = [] }: CallsSummaryTabProps) {
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState(endOfMonth);
  const [sipFilter, setSipFilter] = useState(sipId ?? "");

  const [data, setData] = useState<ZadarmaStatsResponse | null>(null);
  const [sips, setSips] = useState<SipInfoResponse[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSips, setLoadingSips] = useState(!sipId);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch SIP list on mount (skip if sipId is already locked) ──
  useEffect(() => {
    if (sipId) {
      setLoadingSips(false);
      return;
    }
    async function fetchSips() {
      setLoadingSips(true);
      const { data: sipsData, error: sipsError } = await api.GET("/api/v1/zadarma/sips");
      if (!sipsError && sipsData?.data) {
        setSips(sipsData.data);
      }
      setLoadingSips(false);
    }
    fetchSips();
  }, [sipId]);

  // ── Fetch calls summary and shifts ──
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fromParam = dateFrom ? `${dateFrom} 00:00:00` : undefined;
    const toParam = dateTo ? `${dateTo} 23:59:59` : undefined;

    const [callsPromise, shiftsPromise] = await Promise.allSettled([
      api.GET("/api/v1/zadarma/calls-summary", {
        params: {
          query: {
            start: fromParam,
            end: toParam,
            sip: sipFilter || undefined,
          },
        },
      }),
      groupId
        ? api.GET("/api/v1/shifts", {
            params: {
              query: {
                onCallGroupId: groupId,
                from: dateFrom ? new Date(dateFrom + "T00:00:00").toISOString() : undefined,
                to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    // Process calls result
    if (callsPromise.status === "fulfilled") {
      const { data: apiData, error: apiError } = callsPromise.value;
      if (apiError) {
        setError(getErrorMessage(apiError, "Error al consultar las llamadas"));
        setData(null);
      } else {
        setData(apiData?.data ?? null);
      }
    } else {
      setError("Error al consultar las llamadas");
      setData(null);
    }

    // Process shifts result
    if (shiftsPromise && shiftsPromise.status === "fulfilled" && shiftsPromise.value) {
      const { data: shiftsData } = shiftsPromise.value;
      if (shiftsData?.data) {
        setShifts(shiftsData.data);
      }
    }

    setLoading(false);
  }, [dateFrom, dateTo, sipFilter, groupId]);

  // Auto-fetch on mount and filter changes only when sipId is locked (group context)
  useEffect(() => {
    if (sipId) {
      fetchCalls();
    }
  }, [fetchCalls]);

  const calls = data?.stats ?? [];

  // ── Build a set of group people phone numbers for redirection check detection ──
  const groupPhoneNumbers = new Set(
    groupPeople
      .map((p) => p.phoneNumber)
      .filter(Boolean)
      .map((n) => n!.replace(/\D/g, "")) // normalize: strip all non-digit chars
  );

  /** Check if a call from this number is a redirection check (test call from a group member) */
  function isRedirectionCheck(call: ZadarmaCallRecord): boolean {
    // Only non-answered calls from group members are redirection checks
    if (call.disposition === "answered") return false;
    const fromStr = call.from != null ? String(call.from).replace(/\D/g, "") : "";
    if (!fromStr) return false;
    for (const phone of groupPhoneNumbers) {
      if (phone && (fromStr.includes(phone) || phone.includes(fromStr))) {
        return true;
      }
    }
    return false;
  }

  const redirectionChecks = calls.filter(isRedirectionCheck);
  const redirectionCheckIds = new Set(redirectionChecks.map((c) => c.id));

  // ── Match each call to the on-call person at that time ──
  function getOnCallPerson(call: ZadarmaCallRecord): string | null {
    if (!call.callstart) return null;
    try {
      const callTime = new Date(call.callstart.replace(" ", "T")).getTime();
      for (const shift of shifts) {
        if (!shift.startTime || !shift.endTime) continue;
        const shiftStart = new Date(shift.startTime).getTime();
        const shiftEnd = new Date(shift.endTime).getTime();
        if (callTime >= shiftStart && callTime < shiftEnd) {
          return shift.personName ?? null;
        }
      }
    } catch {
      // Invalid date, skip
    }
    return null;
  }

  // ── Summary stats ──
  const totalCalls = calls.length;
  const answeredCalls = calls.filter((c) => c.disposition === "answered").length;
  const missedCalls = calls.filter(
    (c) =>
      (c.disposition === "no answer" || c.disposition === "failed" || c.disposition === "busy" || c.disposition === "cancel") &&
      !redirectionCheckIds.has(c.id)
  ).length;
  const totalDuration = calls.reduce((sum, c) => sum + (c.billseconds ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Filter ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Consultar llamadas recibidas
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Selecciona un período para ver el resumen de llamadas entrantes desde Zadarma
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="calls-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Desde
            </label>
            <input
              id="calls-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="calls-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </label>
            <input
              id="calls-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          {!sipId && sips.length > 0 && (
            <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SIP (opcional)
              </label>
              <div className="mt-1">
                <Select
                  placeholder={loadingSips ? "Cargando SIPs..." : "Todos los SIPs"}
                  options={[
                    { value: "", label: "Todos los SIPs" },
                    ...sips.map((s) => ({
                      value: s.sipId ?? "",
                      label: s.groupName ? `${s.sipId} — ${s.groupName}` : (s.sipId ?? ""),
                    })),
                  ]}
                  value={sipFilter}
                  onChange={(val) => setSipFilter(val)}
                  disabled={loadingSips}
                />
              </div>
            </div>
          )}
          <Button type="button" variant="primary" size="md" loading={loading} onClick={fetchCalls}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            Consultar
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Summary cards ── */}
      {data && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {/* Total calls */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total llamadas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{totalCalls}</p>
                </div>
              </div>
            </div>

            {/* Answered */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Atendidas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{answeredCalls}</p>
                </div>
              </div>
            </div>

            {/* Missed / not answered (excluding redirection checks) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2.5 text-red-600 dark:bg-red-950 dark:text-red-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">No atendidas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{missedCalls}</p>
                </div>
              </div>
            </div>

            {/* Redirection checks */}
            {redirectionChecks.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M8.008 14.657l3.181-3.182" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Comprobaciones</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{redirectionChecks.length}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Total duration */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Duración total</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Calls table ── */}
          {calls.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Listado de llamadas
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {totalCalls} llamada{totalCalls !== 1 ? "s" : ""}
                  {data.start && data.end && (
                    <> · {formatDateTime(data.start)} — {formatDateTime(data.end)}</>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Fecha / Hora</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Origen</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Destino</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Duración</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Estado</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {calls.map((call) => {
                      const isCheck = redirectionCheckIds.has(call.id);
                      const onCallPerson = getOnCallPerson(call);
                      return (
                      <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                          {formatDateTime(call.callstart)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap font-mono text-gray-600 dark:text-gray-400">
                          {formatPhone(call.from)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap font-mono text-gray-600 dark:text-gray-400">
                          {formatPhone(call.to)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {formatDuration(call.billseconds)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {isCheck ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Comprobación
                            </span>
                          ) : (
                            formatDisposition(call.disposition)
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {onCallPerson ?? "—"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-12 dark:border-gray-600 dark:bg-gray-900">
              <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                No se encontraron llamadas en este período
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Prueba con otro rango de fechas o filtro SIP
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial loading state (before first fetch) */}
      {!data && loading && (
        <div className="flex flex-col items-center py-12 text-sm text-gray-400">
          <svg className="mb-3 h-8 w-8 animate-spin text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p>Cargando llamadas...</p>
        </div>
      )}
    </div>
  );
}
