import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/Button";
import { api } from "~/lib/api";
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from "~/lib/format";
import type { components } from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type IncidentResponse = components["schemas"]["IncidentResponse"];
type IncidentRequest = components["schemas"]["IncidentRequest"];
type ApplicationResponse = components["schemas"]["ApplicationResponse"];

interface ApiErrorShape {
  errors?: { message?: string }[];
}
function getApiError(err: unknown, fallback: string): string {
  return (err as ApiErrorShape | undefined)?.errors?.[0]?.message ?? fallback;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const inputCls =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

// ---------------------------------------------------------------------------
// Incident Modal (create + edit)
// ---------------------------------------------------------------------------
interface IncidentModalProps {
  incident: IncidentResponse | null; // null = create mode
  applications: ApplicationResponse[];
  onSave: (id: string | null, req: IncidentRequest) => Promise<string | null>;
  onClose: () => void;
}

function IncidentModal({ incident, applications, onSave, onClose }: IncidentModalProps) {
  const isCreate = incident === null;
  const [title, setTitle] = useState(incident?.title ?? "");
  const [description, setDescription] = useState(incident?.description ?? "");
  const [bridgeOpened, setBridgeOpened] = useState(incident?.bridgeOpened ?? false);
  // Application is optional: incidents are created without one and it is
  // assigned later (while editing) by the user who knows the affected app.
  const [applicationId, setApplicationId] = useState(incident?.applicationId ?? "");
  const [endedAt, setEndedAt] = useState(toDateTimeLocal(incident?.endedAt));
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(incident?.startedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLinkedCalls = (incident?.linkedCallsCount ?? 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("El título es obligatorio"); return; }
    setSaving(true);
    setError(null);
    const err = await onSave(incident?.id ?? null, {
      title: title.trim(),
      description: description || undefined,
      applicationId: applicationId || undefined,
      bridgeOpened,
      startedAt: !hasLinkedCalls ? fromDateTimeLocal(startedAt) : undefined,
      endedAt: fromDateTimeLocal(endedAt),
      callRecordIds: undefined,
    });
    setSaving(false);
    if (err) { setError(err); } else { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isCreate ? "Nueva incidencia" : "Editar incidencia"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Descripción breve" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Aplicación <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <select value={applicationId} onChange={e => setApplicationId(e.target.value)} className={inputCls}>
              <option value="">Sin aplicación</option>
              {applications.map(a => (
                <option key={a.id} value={a.id!}>{a.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Puedes asignarla más adelante, cuando conozcas la aplicación afectada.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} placeholder="Detalles de la incidencia…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!hasLinkedCalls && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Inicio</label>
                <input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} className={inputCls} />
              </div>
            )}
            <div className={hasLinkedCalls ? "col-span-2" : ""}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fecha de fin <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input type="datetime-local" value={endedAt} onChange={e => setEndedAt(e.target.value)} className={inputCls} />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Déjala vacía mientras la incidencia siga abierta.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={bridgeOpened} onChange={e => setBridgeOpened(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Se abrió bridge con el proveedor</span>
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident detail modal
// ---------------------------------------------------------------------------
interface IncidentDetailModalProps {
  incident: IncidentResponse;
  onClose: () => void;
}

function IncidentDetailModal({ incident, onClose }: IncidentDetailModalProps) {
  const isOpen = !incident.endedAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {incident.title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  isOpen
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {isOpen ? "Abierta" : "Finalizada"}
              </span>
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {incident.applicationName ?? "Sin aplicación"}
              </span>
              {incident.bridgeOpened && (
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Bridge abierto
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Descripción
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {incident.description || "Sin descripción."}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 text-sm sm:grid-cols-2 dark:border-gray-800">
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Inicio</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {formatDateTime(incident.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Fecha de fin</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {formatDateTime(incident.endedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Duración</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {formatDuration(incident.durationSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Llamadas vinculadas</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {incident.linkedCallsCount ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Creada</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {formatDateTime(incident.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500">Última actualización</dt>
              <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                {formatDateTime(incident.updatedAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface IncidentsTabProps {
  groupId: string;
  applications: ApplicationResponse[];
}

export function IncidentsTab({ applications }: IncidentsTabProps) {
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [appFilter, setAppFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalIncident, setModalIncident] = useState<IncidentResponse | null | undefined>(undefined); // undefined=closed, null=create, IncidentResponse=edit
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detailIncident, setDetailIncident] = useState<IncidentResponse | null>(null);

  const PAGE_SIZE = 20;

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiErr } = await api.GET("/api/v1/incidents", {
      params: {
        query: {
          page,
          size: PAGE_SIZE,
          sort: ["createdAt,desc"],
          applicationId: appFilter || undefined,
        },
      },
    });
    if (apiErr) {
      setError(getApiError(apiErr, "Error al cargar incidencias"));
    } else if (data?.data) {
      setIncidents(data.data.content ?? []);
      setTotalPages(data.data.totalPages ?? 0);
      setTotalElements(data.data.totalElements ?? 0);
    }
    setLoading(false);
  }, [page, appFilter]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const handleSave = async (id: string | null, req: IncidentRequest): Promise<string | null> => {
    if (id === null) {
      // create
      const { error: apiErr } = await api.POST("/api/v1/incidents", { body: req });
      if (apiErr) return getApiError(apiErr, "Error al crear la incidencia");
    } else {
      // update
      const { error: apiErr } = await api.PUT("/api/v1/incidents/{id}", {
        params: { path: { id } },
        body: req,
      });
      if (apiErr) return getApiError(apiErr, "Error al guardar la incidencia");
    }
    await fetchIncidents();
    return null;
  };

  const handleDelete = async (incident: IncidentResponse) => {
    if (!window.confirm(`¿Eliminar la incidencia "${incident.title}"?`)) return;
    setDeleting(incident.id!);
    const { error: apiErr } = await api.DELETE("/api/v1/incidents/{id}", {
      params: { path: { id: incident.id! } },
    });
    setDeleting(null);
    if (apiErr) {
      setError(getApiError(apiErr, "Error al eliminar la incidencia"));
    } else {
      await fetchIncidents();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Filters + New button ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filtrar por aplicación
          </label>
          <select
            value={appFilter}
            onChange={e => { setAppFilter(e.target.value); setPage(0); }}
            className={inputCls}
          >
            <option value="">Todas las aplicaciones</option>
            {applications.map(a => (
              <option key={a.id} value={a.id!}>{a.name}</option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" size="md" loading={loading} onClick={() => { setPage(0); fetchIncidents(); }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          Actualizar
        </Button>
        <Button type="button" variant="primary" size="md" onClick={() => setModalIncident(null)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva incidencia
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Incidencias</h3>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {totalElements} incidencia{totalElements !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 text-sm text-gray-400">
            <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando…
          </div>
        )}

        {!loading && incidents.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No hay incidencias</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Las llamadas atendidas generan incidencias automáticamente
            </p>
          </div>
        )}

        {!loading && incidents.length > 0 && (
          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            {incidents.map(inc => {
              const isOpen = !inc.endedAt;
              const linkedCalls = inc.linkedCallsCount ?? 0;
              return (
                <article
                  key={inc.id}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-800"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4
                        className="truncate text-sm font-semibold text-gray-900 dark:text-white"
                        title={inc.title}
                      >
                        {inc.title}
                      </h4>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isOpen
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {isOpen ? "Abierta" : "Finalizada"}
                    </span>
                  </header>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5h10.5m-10.5 4.5h10.5m-10.5 4.5h6M4.5 3.75h15a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z" />
                      </svg>
                      {inc.applicationName ?? "Sin aplicación"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                      </svg>
                      {linkedCalls} llamada{linkedCalls !== 1 ? "s" : ""}
                    </span>
                    {inc.bridgeOpened && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                        </svg>
                        Bridge
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs dark:border-gray-800">
                    <div>
                      <dt className="text-gray-400 dark:text-gray-500">Inicio</dt>
                      <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                        {formatDateTime(inc.startedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-gray-500">Duración</dt>
                      <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                        {formatDuration(inc.durationSeconds)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-gray-400 dark:text-gray-500">Fecha de fin</dt>
                      <dd className="mt-0.5 font-medium text-gray-700 dark:text-gray-300">
                        {formatDateTime(inc.endedAt)}
                      </dd>
                    </div>
                  </dl>

                  <footer className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <button
                      onClick={() => setDetailIncident(inc)}
                      className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      Ver detalle
                    </button>
                    <button
                      onClick={() => setModalIncident(inc)}
                      title="Editar"
                      className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(inc)}
                      disabled={deleting === inc.id}
                      title="Eliminar"
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                ← Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Siguiente →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Incident modal (create / edit) ── */}
      {modalIncident !== undefined && (
        <IncidentModal
          incident={modalIncident}
          applications={applications}
          onSave={handleSave}
          onClose={() => setModalIncident(undefined)}
        />
      )}

      {/* ── Incident detail ── */}
      {detailIncident && (
        <IncidentDetailModal
          incident={detailIncident}
          onClose={() => setDetailIncident(null)}
        />
      )}
    </div>
  );
}
