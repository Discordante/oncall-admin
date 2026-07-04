import { useState } from "react";
import { useLoaderData, useNavigate, Link } from "react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Route } from "./+types/_protected.groups.$id";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// Zod schema — form fields use string for number inputs
// ---------------------------------------------------------------------------
const groupSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  grossPricePerDay: z.string().optional(),
  zadarmaSipId: z.string().optional(),
  zadarmaRedirectionType: z.enum(["sip", "pbx"]),
  telegramBotEnabled: z.boolean(),
  telegramGroupChatId: z.string().optional(),
  personIds: z.array(z.string()),
  applicationIds: z.array(z.string()),
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
      zadarmaSipId: group.zadarmaSipId ?? "",
      zadarmaRedirectionType: (group.zadarmaRedirectionType as "sip" | "pbx") ?? "sip",
      telegramBotEnabled: group.telegramBotEnabled ?? false,
      telegramGroupChatId: group.telegramGroupChatId ?? "",
      personIds: group.people?.map((p) => p.id!).filter(Boolean) ?? [],
      applicationIds: group.applications?.map((a) => a.id!).filter(Boolean) ?? [],
    },
  });

  const telegramBotEnabled = watch("telegramBotEnabled");
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
        zadarmaSipId: data.zadarmaSipId || undefined,
        zadarmaRedirectionType: data.zadarmaRedirectionType,
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
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Configuración Zadarma
          </h3>
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
            </div>
            <div>
              <label htmlFor="zadarmaRedirectionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de redirección
              </label>
              <select
                id="zadarmaRedirectionType"
                {...register("zadarmaRedirectionType")}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="sip">SIP</option>
                <option value="pbx">PBX</option>
              </select>
            </div>
          </div>
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
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                  {people.map((person) => (
                    <label
                      key={person.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        field.value.includes(person.id!)
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={field.value.includes(person.id!)}
                        onChange={() => {
                          const newVal = field.value.includes(person.id!)
                            ? field.value.filter((p) => p !== person.id)
                            : [...field.value, person.id!];
                          field.onChange(newVal);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{person.name}</span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">{person.email}</span>
                      </div>
                      {!person.isActive && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          Inactivo
                        </span>
                      )}
                    </label>
                  ))}
                </div>
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
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                  {applications.map((app) => (
                    <label
                      key={app.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        field.value.includes(app.id!)
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={field.value.includes(app.id!)}
                        onChange={() => {
                          const newVal = field.value.includes(app.id!)
                            ? field.value.filter((a) => a !== app.id)
                            : [...field.value, app.id!];
                          field.onChange(newVal);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{app.name}</span>
                        {app.description && (
                          <span className="ml-2 text-gray-500 dark:text-gray-400">{app.description}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
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
