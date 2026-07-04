import { useState } from "react";
import { useLoaderData, useNavigate, Link } from "react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Route } from "./+types/_protected.groups.$id";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";

// ---------------------------------------------------------------------------
// Zod schema — form fields use string for number inputs
// ---------------------------------------------------------------------------
const groupSchema = z.object({
  name: z.string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  grossPricePerDay: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Precio inválido. Usa formato: 150.00")
    .or(z.literal("")),
  zadarmaEnabled: z.boolean(),
  zadarmaSipId: z.string()
    .max(50, "El ID del SIP no puede tener más de 50 caracteres")
    .or(z.literal("")),
  zadarmaRedirectionType: z.enum(["sip", "pbx"]),
  telegramBotEnabled: z.boolean(),
  telegramGroupChatId: z.string()
    .regex(/^-?\d{5,15}$/, "ID de chat inválido. Ej: -1001234567890")
    .or(z.literal("")),
  personIds: z.array(z.string()),
  applicationIds: z.array(z.string()),
}).superRefine((data, ctx) => {
  if (data.telegramBotEnabled && !data.telegramGroupChatId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El ID del chat es obligatorio cuando Telegram está habilitado",
      path: ["telegramGroupChatId"],
    });
  }
  if (data.zadarmaEnabled && !data.zadarmaSipId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El ID del SIP es obligatorio cuando Zadarma está habilitado",
      path: ["zadarmaSipId"],
    });
  }
});

type GroupForm = z.infer<typeof groupSchema>;

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
export default function EditGroup() {
  const { group, people, applications } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group.name ?? "",
      grossPricePerDay: group.grossPricePerDay != null ? String(group.grossPricePerDay) : "",
      zadarmaEnabled: group.zadarmaSipId ? true : false,
      zadarmaSipId: group.zadarmaSipId ?? "",
      zadarmaRedirectionType: (group.zadarmaRedirectionType as "sip" | "pbx") ?? "sip",
      telegramBotEnabled: group.telegramBotEnabled ?? false,
      telegramGroupChatId: group.telegramGroupChatId ?? "",
      personIds: group.people?.map((p) => p.id!).filter(Boolean) ?? [],
      applicationIds: group.applications?.map((a) => a.id!).filter(Boolean) ?? [],
    },
  });

  const telegramBotEnabled = watch("telegramBotEnabled");
  const zadarmaEnabled = watch("zadarmaEnabled");
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onSubmit = async (data: GroupForm) => {
    setServerError(null);

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
        telegramGroupChatId: data.telegramBotEnabled ? (data.telegramGroupChatId || undefined) : undefined,
      },
    });

    if (apiError) {
      const msg = apiError.errors?.[0]?.message ?? "Error al actualizar el grupo";
      setServerError(msg);
      return;
    }

    navigate("/grupos");
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
          {group.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Edita los datos del grupo de guardia
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {serverError}
          </div>
        )}

        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Información básica
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre del grupo *
              </label>
              <input
                id="name"
                type="text"
                {...register("name")}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="grossPricePerDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Precio bruto por día (€)
              </label>
              <input
                id="grossPricePerDay"
                type="number"
                step="0.01"
                min="0"
                {...register("grossPricePerDay")}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                placeholder="Ej: 150"
              />
            </div>
          </div>
        </div>

        {/* Zadarma config */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Configuración Zadarma
            </h3>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                {...register("zadarmaEnabled")}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 dark:bg-gray-600 dark:peer-focus:ring-indigo-800"></div>
            </label>
          </div>
          {zadarmaEnabled && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="zadarmaSipId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  ID del SIP
                </label>
                <input
                  id="zadarmaSipId"
                  type="text"
                  {...register("zadarmaSipId")}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  placeholder="Ej: 921495"
                />
                {errors.zadarmaSipId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.zadarmaSipId.message}</p>
                )}
              </div>
              <Controller
                control={control}
                name="zadarmaRedirectionType"
                render={({ field }) => (
                  <Select
                    label="Tipo de redirección"
                    options={[
                      { value: "sip", label: "SIP" },
                      { value: "pbx", label: "PBX" },
                    ]}
                    value={field.value}
                    onChange={(val) => field.onChange(val)}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Telegram config */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Integración Telegram
            </h3>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                {...register("telegramBotEnabled")}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 dark:bg-gray-600 dark:peer-focus:ring-indigo-800"></div>
            </label>
          </div>
          {telegramBotEnabled && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="telegramGroupChatId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  ID del Chat/Grupo
                </label>
                <input
                  id="telegramGroupChatId"
                  type="text"
                  {...register("telegramGroupChatId")}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  placeholder="Ej: -1001234567890"
                />
              </div>
            </div>
          )}
        </div>

        {/* People selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Personas
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Personas asignadas al grupo
              </p>
            </div>
            <Link to="/personas/nueva">
              <Button type="button" variant="outline" size="sm">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva persona
              </Button>
            </Link>
          </div>
          {people.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">No hay personas disponibles.</p>
          ) : (
            <Controller
              control={control}
              name="personIds"
              render={({ field }) => (
                <Select
                  mode="multi"
                  placeholder="Buscar personas..."
                  options={people.map((p) => ({
                    value: p.id!,
                    label: `${p.name}${p.email ? ` — ${p.email}` : ""}${!p.isActive ? " (Inactivo)" : ""}`,
                  }))}
                  value={field.value}
                  onChange={(val) => field.onChange(val)}
                />
              )}
            />
          )}
        </div>

        {/* Applications selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Aplicaciones
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Aplicaciones asignadas al grupo
              </p>
            </div>
            <Link to="/aplicaciones/nueva">
              <Button type="button" variant="outline" size="sm">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva aplicación
              </Button>
            </Link>
          </div>
          {applications.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">No hay aplicaciones disponibles.</p>
          ) : (
            <Controller
              control={control}
              name="applicationIds"
              render={({ field }) => (
                <Select
                  mode="multi"
                  placeholder="Buscar aplicaciones..."
                  options={applications.map((a) => ({
                    value: a.id!,
                    label: `${a.name}${a.description ? ` — ${a.description}` : ""}`,
                  }))}
                  value={field.value}
                  onChange={(val) => field.onChange(val)}
                />
              )}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <Link to="/grupos">
              <Button type="button" variant="outline" size="md">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
