import { useState } from "react";
import { useNavigate, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/_protected.groups.new";
import { api } from "~/lib/api";
import { GroupForm } from "~/components/GroupForm";
import type { GroupFormData } from "~/components/GroupForm";

// ---------------------------------------------------------------------------
// clientLoader — load people and applications for the form selects
// ---------------------------------------------------------------------------
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const [peopleRes, appsRes] = await Promise.all([
    api.GET("/api/v1/people", { params: { query: { includeInactive: true } } }),
    api.GET("/api/v1/applications"),
  ]);

  return {
    people: peopleRes.data?.data ?? [],
    applications: appsRes.data?.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NewGroup() {
  const { people, applications } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: GroupFormData): Promise<string | null> => {
    setServerError(null);

    const parsedPrice = data.grossPricePerDay ? Number(data.grossPricePerDay) : undefined;

    const { data: result, error: apiError } = await api.POST("/api/v1/on-call-groups", {
      body: {
        name: data.name,
        grossPricePerDay: parsedPrice,
        personIds: data.personIds.length > 0 ? data.personIds : undefined,
        applicationIds: data.applicationIds.length > 0 ? data.applicationIds : undefined,
        zadarmaSipId: data.zadarmaEnabled ? (data.zadarmaSipId || undefined) : undefined,
        zadarmaRedirectionType: data.zadarmaEnabled ? data.zadarmaRedirectionType : undefined,
        telegramBotEnabled: data.telegramBotEnabled,
        telegramBotToken: data.telegramBotEnabled ? (data.telegramBotToken || undefined) : undefined,
        telegramGroupChatId: data.telegramBotEnabled ? (data.telegramGroupChatId || undefined) : undefined,
      },
    });

    if (apiError) {
      return apiError.errors?.[0]?.message ?? "Error al crear el grupo";
    }

    navigate(`/grupos/${result?.data?.id}`);
    return null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/grupos"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver a grupos
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          Nuevo Grupo de Guardia
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Crea un nuevo grupo para gestionar guardias
        </p>
      </div>

      <GroupForm
        people={people}
        applications={applications}
        onSubmit={onSubmit}
        submitLabel="Crear grupo"
      />
    </div>
  );
}
