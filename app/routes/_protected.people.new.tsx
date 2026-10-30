import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Route } from "./+types/_protected.people.new";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/Button";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
// Digits only, country code included, no + or separators (e.g. 34638407212)
const phoneRegex = /^\d{9,15}$/;

const personSchema = z.object({
  name: z.string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  email: z.string()
    .min(1, "El email es obligatorio")
    .email("Email inválido"),
  phoneNumber: z.string()
    .regex(phoneRegex, "Solo dígitos con prefijo de país. Ej: 34612345678")
    .or(z.literal("")),
  isActive: z.boolean(),
});

type PersonForm = z.infer<typeof personSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NewPerson() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      isActive: true,
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: PersonForm) => {
    setServerError(null);

    const { data: result, error: apiError } = await api.POST("/api/v1/people", {
      body: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber || undefined,
        isActive: data.isActive,
      },
    });

    if (apiError) {
      const msg = apiError.errors?.[0]?.message ?? "Error al crear la persona";
      setServerError(msg);
      return;
    }

    navigate(`/personas/${result?.data?.id}`);
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
          Nueva Persona
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Añade una nueva persona al sistema
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
                placeholder="Ej: Juan Pérez"
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
                placeholder="Ej: juan.perez@nextdigital.es"
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
                placeholder="Ej: 34612345678"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Solo dígitos, prefijo de país incluido (sin + ni espacios)</p>
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
        <div className="flex items-center justify-end gap-3">
          <Link to="/personas">
            <Button type="button" variant="outline" size="md">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
            Crear persona
          </Button>
        </div>
      </form>
    </div>
  );
}
