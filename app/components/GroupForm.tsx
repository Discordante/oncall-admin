import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useForm, Controller, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/Button";
import { Select, assignChipColors } from "~/components/ui/Select";

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
  telegramBotToken: z.string()
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "Token de bot inválido. Ej: 123456:ABCdef")
    .or(z.literal("")),
  telegramGroupChatId: z.string()
    .regex(/^-?\d{5,15}$/, "ID de chat inválido. Ej: -1001234567890")
    .or(z.literal("")),
  personIds: z.array(z.string()),
  applicationIds: z.array(z.string()),
}).superRefine((data, ctx) => {
  if (data.telegramBotEnabled) {
    if (!data.telegramBotToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El token del bot es obligatorio cuando Telegram está habilitado",
        path: ["telegramBotToken"],
      });
    }
    if (!data.telegramGroupChatId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El ID del chat es obligatorio cuando Telegram está habilitado",
        path: ["telegramGroupChatId"],
      });
    }
  }
  if (data.zadarmaEnabled && !data.zadarmaSipId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El ID del SIP es obligatorio cuando Zadarma está habilitado",
      path: ["zadarmaSipId"],
    });
  }
});

export type GroupFormData = z.infer<typeof groupSchema>;

// ---------------------------------------------------------------------------
// Types for people & applications
// ---------------------------------------------------------------------------
interface PersonItem {
  id?: string;
  name?: string;
  email?: string;
  isActive?: boolean;
}

interface ApplicationItem {
  id?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface GroupFormProps {
  people: PersonItem[];
  applications: ApplicationItem[];
  defaultValues?: Partial<GroupFormData>;
  /** Called with the validated form data. Return an error string or null/undefined on success. */
  onSubmit: (data: GroupFormData) => Promise<string | null | undefined>;
  /** Label for the submit button */
  submitLabel?: string;
  /** Content rendered on the left side of the footer (e.g. delete button) */
  footerLeft?: ReactNode;
  /** Where to navigate on cancel */
  cancelTo?: string;
  /** Telegram group invite link (read-only, from API response) */
  telegramGroupInviteLink?: string;
  /** When true, Cancel & Save buttons are hidden until the user modifies a field (edit mode) */
  hideActionsWhenPristine?: boolean;
}

// ---------------------------------------------------------------------------
// Shared field class name
// ---------------------------------------------------------------------------
const inputCls =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

// ---------------------------------------------------------------------------
// Password field with show/hide toggle
// ---------------------------------------------------------------------------
function PasswordField({
  id,
  label,
  register,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  placeholder?: string;
  error?: string;
}) {
  // We use a local state because we can't hook into the parent's useState from here
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          {...register}
          className={inputCls + " pr-10"}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          tabIndex={-1}
          aria-label={visible ? "Ocultar token" : "Mostrar token"}
        >
          {visible ? (
            /* Eye-off icon */
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            /* Eye icon */
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function GroupForm({
  people,
  applications,
  defaultValues,
  onSubmit,
  submitLabel = "Guardar",
  footerLeft,
  cancelTo = "/grupos",
  telegramGroupInviteLink,
  hideActionsWhenPristine = false,
}: GroupFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      grossPricePerDay: "",
      zadarmaEnabled: false,
      zadarmaSipId: "",
      zadarmaRedirectionType: "sip",
      telegramBotEnabled: false,
      telegramBotToken: "",
      telegramGroupChatId: "",
      personIds: [],
      applicationIds: [],
      ...defaultValues,
    },
  });

  const telegramBotEnabled = watch("telegramBotEnabled");
  const zadarmaEnabled = watch("zadarmaEnabled");
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Build coloured options once
  const peopleOptions = assignChipColors(
    people.map((p) => ({
      value: p.id!,
      label: p.name ?? "",
    }))
  );

  const applicationOptions = assignChipColors(
    applications.map((a) => ({
      value: a.id!,
      label: a.name ?? "",
    }))
  );

  const onFormSubmit = async (data: GroupFormData) => {
    setServerError(null);
    const error = await onSubmit(data);
    if (error) {
      setServerError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
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
              className={inputCls}
              placeholder="Ej: Guardia-Sistemas-Q1"
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
              className={inputCls}
              placeholder="Ej: 150"
            />
            {errors.grossPricePerDay && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.grossPricePerDay.message}</p>
            )}
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
                className={inputCls}
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
            <PasswordField
              id="telegramBotToken"
              label="Token del Bot *"
              register={register("telegramBotToken", {
                onChange: (e) => {
                  if (!e.target.value && telegramBotEnabled) {
                    setValue("telegramBotEnabled", false, { shouldDirty: false });
                  }
                },
              })}
              placeholder="Token del bot de Telegram"
              error={errors.telegramBotToken?.message}
            />
            <div>
              <label htmlFor="telegramGroupChatId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ID del Chat/Grupo *
              </label>
              <input
                id="telegramGroupChatId"
                type="text"
                {...register("telegramGroupChatId", {
                  onChange: (e) => {
                    if (!e.target.value && telegramBotEnabled) {
                      setValue("telegramBotEnabled", false, { shouldDirty: false });
                    }
                  },
                })}
                className={inputCls}
                placeholder="Ej: -1001234567890"
              />
              {errors.telegramGroupChatId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.telegramGroupChatId.message}</p>
              )}
            </div>
            {telegramGroupInviteLink && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Link de invitación
                </label>
                <div className="relative mt-1">
                  <input
                    type="url"
                    readOnly
                    value={telegramGroupInviteLink}
                    className={inputCls + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(telegramGroupInviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                    aria-label="Copiar link"
                  >
                    {copied ? (
                      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Generado automáticamente al configurar el bot
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* People selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Personas
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Selecciona las personas que pertenecerán a este grupo
        </p>
        {people.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            No hay personas disponibles.{" "}
            <Link to="/personas/nueva" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Crea una persona primero
            </Link>
          </p>
        ) : (
          <Controller
            control={control}
            name="personIds"
            render={({ field }) => (
              <Select
                mode="multi"
                placeholder="Buscar personas..."
                options={peopleOptions}
                value={field.value}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        )}
      </div>

      {/* Applications selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Aplicaciones
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Selecciona las aplicaciones asignadas a este grupo
        </p>
        {applications.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            No hay aplicaciones disponibles.{" "}
            <Link to="/aplicaciones/nueva" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Crea una aplicación primero
            </Link>
          </p>
        ) : (
          <Controller
            control={control}
            name="applicationIds"
            render={({ field }) => (
              <Select
                mode="multi"
                placeholder="Buscar aplicaciones..."
                options={applicationOptions}
                value={field.value}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {footerLeft ? (
          <div>{footerLeft}</div>
        ) : (
          <div />
        )}
        {(!hideActionsWhenPristine || isDirty) && (
          <div className="flex items-center gap-3">
            <Link to={cancelTo}>
              <Button type="button" variant="outline" size="md">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
