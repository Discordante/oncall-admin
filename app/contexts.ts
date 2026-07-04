import { createContext } from "react-router";
import type { JwtPayload } from "~/lib/auth";

/**
 * Context for passing the authenticated user through the component tree.
 * Not strictly needed now that we use clientLoader + useLoaderData,
 * but kept for potential future use with React Router's context API.
 */
export const userContext = createContext<JwtPayload | null>(null);
