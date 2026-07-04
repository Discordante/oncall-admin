import { useLoaderData } from "react-router";
import type { Route } from "./+types/_protected.dashboard";
import { getPayload } from "~/lib/auth";

/**
 * clientLoader – reads the user from the JWT stored in localStorage.
 * The _protected parent layout already verified the JWT is valid.
 */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const user = getPayload();
  return { user };
}

/**
 * Main dashboard panel — first view after login.
 */
export default function Dashboard() {
  const { user } = useLoaderData<typeof clientLoader>();

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

      {/* Placeholder for upcoming panels */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Próximas guardias
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Panel de guardias — próximamente
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Actividad reciente
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Sin actividad reciente
          </p>
        </div>
      </div>
    </div>
  );
}
