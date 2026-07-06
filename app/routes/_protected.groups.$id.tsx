import { useState } from "react";
import { useLoaderData, useNavigate, Link } from "react-router";
import type { Route } from "./+types/_protected.groups.$id";
import { api } from "~/lib/api";
import { GroupForm } from "~/components/GroupForm";
import type { GroupFormData } from "~/components/GroupForm";
import { ShiftManager } from "~/components/ShiftManager";
import { BillingTab } from "~/components/BillingTab";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------
type TabId = "info" | "shifts" | "billing";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "info",
    label: "Información",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "shifts",
    label: "Turnos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    ),
  },
  {
    id: "billing",
    label: "Facturación",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// clientLoader
// ---------------------------------------------------------------------------
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [groupRes, peopleRes, appsRes] = await Promise.all([
    api.GET("/api/v1/on-call-groups/{id}", { params: { path: { id: params.id } } }),
    api.GET("/api/v1/people", { params: { query: { includeInactive: true } } }),
    api.GET("/api/v1/applications"),
  ]);

  if (groupRes.error || !groupRes.data?.data) {
    throw new Error("Grupo de guardia no encontrado");
  }

  return {
    group: groupRes.data.data,
    people: peopleRes.data?.data ?? [],
    applications: appsRes.data?.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GroupDashboard() {
  const { group, people, applications } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Group form handlers (same logic as before) ──
  const defaultValues: Partial<GroupFormData> = {
    name: group.name ?? "",
    grossPricePerDay: group.grossPricePerDay != null ? String(group.grossPricePerDay) : "",
    zadarmaEnabled: group.zadarmaSipId ? true : false,
    zadarmaSipId: group.zadarmaSipId ?? "",
    zadarmaRedirectionType: (group.zadarmaRedirectionType as "sip" | "pbx") ?? "sip",
    telegramBotEnabled: group.telegramBotEnabled ?? false,
    telegramBotToken: group.telegramBotToken ?? "",
    telegramGroupChatId: group.telegramGroupChatId ?? "",
    personIds: group.people?.map((p) => p.id!).filter(Boolean) ?? [],
    applicationIds: group.applications?.map((a) => a.id!).filter(Boolean) ?? [],
  };

  const onSubmit = async (data: GroupFormData): Promise<string | null> => {
    setServerError(null);
    setSaveSuccess(false);

    const parsedPrice = data.grossPricePerDay ? Number(data.grossPricePerDay) : undefined;

    const { error: apiError } = await api.PUT("/api/v1/on-call-groups/{id}", {
      params: { path: { id: group.id! } },
      body: {
        name: data.name,
        grossPricePerDay: parsedPrice,
        personIds: data.personIds.length > 0 ? data.personIds : undefined,
        applicationIds: data.applicationIds.length > 0 ? data.applicationIds : undefined,
        zadarmaSipId: data.zadarmaEnabled ? (data.zadarmaSipId || undefined) : undefined,
        zadarmaRedirectionType: data.zadarmaEnabled ? data.zadarmaRedirectionType : undefined,
        telegramBotEnabled: data.telegramBotEnabled,
        telegramBotToken: data.telegramBotToken || undefined,
        telegramGroupChatId: data.telegramGroupChatId || undefined,
      },
    });

    if (apiError) {
      return apiError.errors?.[0]?.message ?? "Error al actualizar el grupo";
    }

    // Show success message instead of navigating away
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
    return null;
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting(true);
    const { error } = await api.DELETE("/api/v1/on-call-groups/{id}", {
      params: { path: { id: group.id! } },
    });

    if (error) {
      alert("Error al eliminar el grupo");
      setDeleting(false);
      return;
    }

    navigate("/grupos");
  };

  // ── Build people list from the group for ShiftManager / BillingTab ──
  const groupPeople = (group.people ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Header ── */}
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
          {group.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gestiona la configuración, turnos y facturación del grupo
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                className={[
                  "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Save success toast ── */}
      {saveSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          Grupo actualizado correctamente.
        </div>
      )}

      {/* ── Tab content ── */}
      {/* Info tab: hidden instead of unmounted to preserve form state */}
      <div className={activeTab === "info" ? "" : "hidden"}>
        <div className="max-w-2xl space-y-6">
          <GroupForm
            key={group.id}
            people={people}
            applications={applications}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitLabel="Guardar cambios"
            hideActionsWhenPristine
            telegramGroupInviteLink={group.telegramGroupInviteLink}
            footerLeft={
              <Button
                type="button"
                variant="danger"
                size="md"
                loading={deleting}
                onClick={handleDelete}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Eliminar grupo
              </Button>
            }
          />
        </div>
      </div>

      {/* Shifts tab */}
      {activeTab === "shifts" && (
        <ShiftManager groupId={group.id!} people={groupPeople} />
      )}

      {/* Billing tab */}
      {activeTab === "billing" && (
        <BillingTab
          groupId={group.id!}
          grossPricePerDay={group.grossPricePerDay}
          groupPeople={groupPeople}
        />
      )}
    </div>
  );
}
