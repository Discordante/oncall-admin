import { z } from "zod";

/**
 * Esquema de validación de variables de entorno del frontend.
 *
 * En Vite, las variables expuestas al cliente deben empezar con `VITE_`
 * y se acceden mediante `import.meta.env`.
 *
 * Este módulo se importa en `root.tsx` para que la validación ocurra
 * durante el arranque del dev server o en el build.
 *
 * Si falta alguna variable obligatoria, Zod lanza un error descriptivo
 * que se muestra en la consola del navegador o terminal.
 */

const envSchema = z.object({
  /** URL base del backend (Spring Boot en Railway) */
  VITE_BACKEND_URL: z
    .string()
    .url("VITE_BACKEND_URL debe ser una URL válida")
    .min(1, "VITE_BACKEND_URL es obligatoria"),
  /**
   * En desarrollo local, activa proxy de Vite para evitar CORS
   * consumiendo backend remoto con rutas relativas (/api, /oauth2...).
   */
  VITE_USE_DEV_PROXY: z.enum(["true", "false"]).optional(),
  /**
   * JWT opcional para desarrollo local. Si existe y no hay token guardado,
   * se inyecta automáticamente en localStorage.
   */
  VITE_DEV_JWT: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  console.error("❌ Variables de entorno inválidas:\n" + issues);

  if (import.meta.env.PROD) {
    throw new Error(
      "Falló la validación de variables de entorno. Revisa el .env",
    );
  }
}

export const env = parsed.data ?? {
  VITE_BACKEND_URL: "http://localhost:5173",
  VITE_USE_DEV_PROXY: "true",
  VITE_DEV_JWT: "",
};

export const useDevProxy =
  import.meta.env.DEV && (env.VITE_USE_DEV_PROXY ?? "true") !== "false";

export type Env = z.infer<typeof envSchema>;
