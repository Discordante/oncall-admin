/**
 * API client — Oncall REST API
 *
 * Uso básico:
 * ```ts
 * import { api } from "~/lib/api";
 *
 * // GET /api/v1/people
 * const { data, error } = await api.GET("/api/v1/people");
 * if (data) console.log(data.data); // PersonResponse[]
 *
 * // GET /api/v1/shifts?personId=...
 * const shifts = await api.GET("/api/v1/shifts", {
 *   params: { query: { personId: "uuid", from: "2026-01-01T00:00:00Z" } },
 * });
 *
 * // POST /api/v1/people
 * const created = await api.POST("/api/v1/people", {
 *   body: { name: "Juan Pérez", email: "juan@example.com" },
 * });
 * ```
 */

export { api } from "./client";
export type { paths, components } from "./schema";
