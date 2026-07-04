import { Outlet, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/_protected";
import { getPayload, clearJwt } from "~/lib/auth";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// clientLoader – runs on every navigation. Redirects to /login if the JWT
// is missing or expired.
// ---------------------------------------------------------------------------
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const user = getPayload();
  if (!user) {
    throw redirect("/login");
  }
  return { user };
}

// ---------------------------------------------------------------------------
// Protected layout component
// ---------------------------------------------------------------------------
export default function ProtectedLayout() {
  const { user } = useLoaderData() as { user: NonNullable<ReturnType<typeof getPayload>> };
  const navigate = useNavigate();

  const handleLogout = () => {
    clearJwt();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            OnCall Admin
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {user.name}
              </span>
            </div>

            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
