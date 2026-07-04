import { useLoaderData, useNavigate, Link } from "react-router";
import type { Route } from "./+types/_protected.applications";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// clientLoader
// ---------------------------------------------------------------------------
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { data, error } = await api.GET("/api/v1/applications");

  if (error) {
    throw new Error("Error al cargar aplicaciones");
  }

  return { applications: data?.data ?? [] };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ApplicationsList() {
  const { applications } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la aplicación "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    const { error } = await api.DELETE("/api/v1/applications/{id}", {
      params: { path: { id } },
    });

    if (error) {
      alert("Error al eliminar la aplicación");
      return;
    }

    navigate(".", { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Aplicaciones
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona las aplicaciones dadas de alta en las guardias
          </p>
        </div>
        <Link to="/aplicaciones/nueva">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva aplicación
          </Button>
        </Link>
      </div>

      {/* List */}
      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-600 dark:bg-gray-900">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0A2.25 2.25 0 016.75 3.75h10.5A2.25 2.25 0 0119.5 6M4.5 6v6a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0119.5 12V6" />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            No hay aplicaciones
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Crea tu primera aplicación para empezar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            >
              <Link to={`/aplicaciones/${app.id}`} className="block">
                <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {app.name}
                </h3>
                {app.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {app.description}
                  </p>
                )}
                <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  Creada: {app.createdAt ? new Date(app.createdAt).toLocaleDateString("es-ES") : "—"}
                </div>
              </Link>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(app.id!, app.name!);
                }}
                className="absolute right-3 top-3 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
                title="Eliminar aplicación"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
