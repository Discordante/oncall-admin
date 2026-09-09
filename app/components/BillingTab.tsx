import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";
import { api } from "~/lib/api";
import type { components } from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BillingReportResponse = components["schemas"]["BillingReportResponse"];

/** Generic API error shape */
interface ApiErrorShape {
  errors?: { message?: string }[];
}

function getErrorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiErrorShape | undefined;
  return apiErr?.errors?.[0]?.message ?? fallback;
}

export interface BillingTabProps {
  groupId: string;
  grossPricePerDay?: number;
  groupPeople: { id?: string; name?: string }[];
}

// ---------------------------------------------------------------------------
// Shared input class (same as GroupForm)
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

function formatCurrency(val?: number): string {
  if (val == null) return "—";
  return `${val.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** Escapes a CSV cell value when needed */
function csvEscape(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Formats total hours as "x días y x horas" */
function formatDuration(totalHours?: number): string {
  if (totalHours == null) return "—";
  const rounded = Math.round(totalHours);
  const days = Math.floor(rounded / 24);
  const hours = rounded % 24;

  return `${days} día${days === 1 ? "" : "s"} y ${hours} hora${hours === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BillingTab({ groupId, grossPricePerDay, groupPeople }: BillingTabProps) {
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState(endOfMonth);
  const [personFilter, setPersonFilter] = useState("");

  const [billing, setBilling] = useState<BillingReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fromIso = dateFrom ? new Date(dateFrom + "T00:00:00").toISOString() : undefined;
    const toIso = dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined;

    const { data, error: apiError } = await api.GET("/api/v1/billing", {
      params: {
        query: {
          groupId,
          from: fromIso,
          to: toIso,
          personId: personFilter || undefined,
        },
      },
    });

    if (apiError) {
      setError(getErrorMessage(apiError, "Error al calcular la facturación"));
      setBilling(null);
    } else {
      setBilling(data?.data ?? null);
    }

    setLoading(false);
  }, [groupId, dateFrom, dateTo, personFilter]);

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const details = billing?.details ?? [];
  const activePeople = groupPeople.filter((p) => p.id && p.name);

  // ── CSV download (same data shown in the details table) ──
  const downloadCsv = () => {
    const rows = [
      ["Persona", "Email", "Tiempo", "Horas totales", "Facturación"],
      ...details.map((d) => [
        d.personName ?? "",
        d.personEmail ?? "",
        formatDuration(d.totalHours),
        d.totalHours != null ? String(Math.round(d.totalHours)) : "",
        d.totalBilling != null ? formatCurrency(d.totalBilling) : "",
      ]),
    ];

    // BOM + semicolon separator for correct Excel (es-ES) opening
    const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `facturacion_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── Filter ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Calcular facturación
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Selecciona un período para calcular las horas y el importe a facturar
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="bill-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Desde
            </label>
            <input
              id="bill-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
            <label htmlFor="bill-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </label>
            <input
              id="bill-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          {activePeople.length > 0 && (
            <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Persona (opcional)
              </label>
              <div className="mt-1">
                <Select
                  placeholder="Todas las personas"
                  options={[{
                    value: "",
                    label: "Todas las personas",
                  }, ...activePeople.map((p) => ({
                    value: p.id!,
                    label: p.name ?? "",
                  }))]}
                  value={personFilter}
                  onChange={(val) => setPersonFilter(val)}
                />
              </div>
            </div>
          )}
          <Button type="button" variant="primary" size="md" loading={loading} onClick={fetchBilling}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Calcular
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
      {billing && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total horas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {billing.totalHours != null ? `${Math.round(billing.totalHours)}h` : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total facturación</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(billing.totalBilling)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Precio bruto/día</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(grossPricePerDay ?? billing.grossPricePerDay)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Details table ── */}
          {details.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Desglose por persona
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadCsv}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  }
                >
                  Descargar CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Persona</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Tiempo</th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Horas totales</th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Facturación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {details.map((d, i) => (
                      <tr key={d.personId ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                          {d.personName ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                          {d.personEmail ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400">
                          {formatDuration(d.totalHours)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400">
                          {d.totalHours != null ? `${Math.round(d.totalHours)}h` : "—"}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(d.totalBilling)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No details when filtered by person but it's actually in details */}
          {details.length === 0 && !personFilter && billing.totalHours != null && (
            <div className="flex flex-col items-center py-12 text-sm text-gray-400">
              <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No hay datos de facturación en este período
            </div>
          )}
        </>
      )}
    </div>
  );
}
