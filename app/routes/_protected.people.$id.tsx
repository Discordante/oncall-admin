import { useState } from "react";
import { useLoaderData, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Route } from "./+types/_protected.people.$id";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const personSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  phoneNumber: z.string().optional(),
  isActive: z.boolean(),
});

type PersonForm = z.infer<typeof personSchema>;

// ---------------------------------------------------------------------------
// clientLoader
// ---------------------------------------------------------------------------
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { data, error } = await api.GET("/api/v1/people/{id}", {
    params: { path: { id: params.id } },
  });

  if (error || !data?.data) {
    throw new Error("Persona no encontrada");
  }

  return { person: data.data };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EditPerson() {
  const { person } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: person.name ?? "",
      email: person.email ?? "",
      phoneNumber: person.phoneNumber ?? "",
      isActive: person.isActive ?? true,
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onSubmit = async (data: PersonForm) => {
    setServerError(null);

    const { error: apiError } = await api.PUT("/api/v1/people/{id}", {
      params: { path: { id: person.id! } },
      body: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber || undefined,
        isActive: data.isActive,
      },
    });

    if (apiError) {
      const msg = apiError.errors?.[0]?.message ?? "Error al actualizar la persona";
      setServerError(msg);
      return;
    }

    navigate("/personas");
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar a "${person.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting(true);
    const { error } = await api.DELETE("/api/v1/people/{id}", {
      params: { path: { id: person.id! } },
    });

    if (error) {
      alert("Error al eliminar la persona");
      setDeleting(false);
      return;
    }

    navigate("/personas");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/personas"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver a personas
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {person.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Edita los datos de la persona
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {serverError}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre completo *
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Correo electrónico *
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Número de teléfono
              </label>
              <input
                id="phoneNumber"
                type="text"
                {...register("phoneNumber")}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                placeholder="Ej: +34 612 345 678"
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phoneNumber.message}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                {...register("isActive")}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Persona activa
              </label>
            </div>
          </div>
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
            Eliminar persona
          </Button>
          <div className="flex items-center gap-3">
            <Link to="/personas">
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
