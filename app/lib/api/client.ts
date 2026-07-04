import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { getJwt } from "../auth";
import { env } from "../env";

/**
 * Cliente HTTP tipado para la API Oncall.
 *
 * Los tipos se generan automáticamente desde el esquema OpenAPI.
 * Para regenerarlos:
 *
 *   npm run api:types
 *
 * Ejemplo de uso:
 *
 *   import { api } from "~/lib/api/client";
 *
 *   const { data, error } = await api.GET("/api/v1/people");
 *   if (error) { ... }
 *   console.log(data);
 */

export const api = createClient<paths>({
  baseUrl: env.VITE_BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// Middleware: inyecta el JWT de autenticación en cada petición
// ---------------------------------------------------------------------------

api.use({
  async onRequest({ request }) {
    const token = getJwt();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});
