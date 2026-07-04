import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/_protected.dashboard";
import { getPayload } from "~/lib/auth";
import { api } from "~/lib/api";

/**
 * clientLoader – reads the user from the JWT and loads summary stats.
 */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const user = getPayload();

  const [groupsRes, appsRes, peopleRes] = await Promise.all([
    api.GET("/api/v1/on-call-groups"),
    api.GET("/api/v1/applications"),
    api.GET("/api/v1/people", { params: { query: { includeInactive: true } } }),
  ]);

  return {
    user,
    stats: {
      groupsCount: groupsRes.data?.data?.length ?? 0,
      applicationsCount: appsRes.data?.data?.length ?? 0,
      peopleCount: peopleRes.data?.data?.length ?? 0,
    },
  };
}

/**
 * Main dashboard panel — first view after login.
 */
export default function Dashboard() {
  const { user, stats } = useLoaderData<typeof clientLoader>();

  const cards = [
    {
      title: "Grupos de Guardia",
      count: stats.groupsCount,
      href: "/grupos",
      hrefNew: "/grupos/nuevo",
      color: "indigo",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      title: "Aplicaciones",
      count: stats.applicationsCount,
      href: "/aplicaciones",
      hrefNew: "/aplicaciones/nueva",
      color: "emerald",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0A2.25 2.25 0 016.75 3.75h10.5A2.25 2.25 0 0119.5 6M4.5 6v6a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0119.5 12V6" />
        </svg>
      ),
    },
    {
      title: "Personas",
      count: stats.peopleCount,
      href: "/personas",
      hrefNew: "/personas/nueva",
      color: "violet",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Bienvenido{user ? `, ${user.name}` : ""}
        </h2>
        {user && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            to={card.href}
            className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-lg bg-${card.color}-50 p-3 text-${card.color}-600 dark:bg-${card.color}-950 dark:text-${card.color}-400`}>
                {card.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {card.count}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-sm text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
              <span>Ver todos</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-indigo-600 dark:text-indigo-400">Añadir nuevo</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent items placeholder */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Acceso rápido
          </h3>
          <div className="mt-4 space-y-2">
            <Link
              to="/grupos"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              Gestionar grupos de guardia
            </Link>
            <Link
              to="/aplicaciones"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0A2.25 2.25 0 016.75 3.75h10.5A2.25 2.25 0 0119.5 6M4.5 6v6a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0119.5 12V6" />
              </svg>
              Gestionar aplicaciones
            </Link>
            <Link
              to="/personas"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
              </svg>
              Gestionar personas
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Resumen
          </h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">Grupos de guardia</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{stats.groupsCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">Aplicaciones</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{stats.applicationsCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">Personas</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{stats.peopleCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
