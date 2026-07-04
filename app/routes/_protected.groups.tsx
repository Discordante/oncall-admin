import { useLoaderData, useNavigate, Link } from "react-router";
import type { Route } from "./+types/_protected.groups";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// clientLoader
// ---------------------------------------------------------------------------
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { data, error } = await api.GET("/api/v1/on-call-groups");

  if (error) {
    throw new Error("Error al cargar grupos de guardia");
  }

  return { groups: data?.data ?? [] };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GroupsList() {
  const { groups } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el grupo "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    const { error } = await api.DELETE("/api/v1/on-call-groups/{id}", {
      params: { path: { id } },
    });

    if (error) {
      alert("Error al eliminar el grupo");
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
            Grupos de Guardia
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona los grupos de guardia del sistema
          </p>
        </div>
        <Link to="/grupos/nuevo" className="shrink-0">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="whitespace-nowrap">Nuevo grupo</span>
          </Button>
        </Link>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-600 dark:bg-gray-900">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            No hay grupos de guardia
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Crea tu primer grupo de guardia para empezar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            >
              <Link to={`/grupos/${group.id}`} className="block">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                      {group.name}
                    </h3>
                    {group.grossPricePerDay != null && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {group.grossPricePerDay.toLocaleString("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        })}
                        /día
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {group.people?.length ?? 0} personas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0A2.25 2.25 0 016.75 3.75h10.5A2.25 2.25 0 0119.5 6M4.5 6v6a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0119.5 12V6" />
                    </svg>
                    {group.applications?.length ?? 0} apps
                  </span>
                </div>
              </Link>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(group.id!, group.name!);
                }}
                className="absolute right-3 top-3 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
                title="Eliminar grupo"
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
