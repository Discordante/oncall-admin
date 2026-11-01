// ---------------------------------------------------------------------------
// Client-side JWT management.
// The backend (Spring Boot on Railway) handles all Google OAuth and returns
// a JWT token in the URL after successful authentication.
// ---------------------------------------------------------------------------

import { env, useDevProxy } from "./env";

const JWT_KEY = "oncall_jwt";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  name: string;
  picture?: string;
  exp: number;
}

function ensureDevJwtSeeded(): void {
  if (!import.meta.env.DEV) return;

  const devJwt = env.VITE_DEV_JWT?.trim();
  if (!devJwt) return;

  if (!localStorage.getItem(JWT_KEY)) {
    localStorage.setItem(JWT_KEY, devJwt);
  }
}

// ---------------------------------------------------------------------------
// Store / retrieve / clear the JWT in localStorage
// ---------------------------------------------------------------------------

export function getJwt(): string | null {
  ensureDevJwtSeeded();
  return localStorage.getItem(JWT_KEY);
}

export function setJwt(token: string): void {
  localStorage.setItem(JWT_KEY, token);
}

export function clearJwt(): void {
  localStorage.removeItem(JWT_KEY);
}

// ---------------------------------------------------------------------------
// Decode the JWT payload (no verification — the backend already verified it)
// ---------------------------------------------------------------------------

export function getPayload(): JwtPayload | null {
  const token = getJwt();
  if (!token) return null;

  try {
    const base64 = token.split(".")[1];
    const json = atob(base64);
    const payload = JSON.parse(json) as JwtPayload;

    // Check expiry
    if (payload.exp * 1000 < Date.now()) {
      clearJwt();
      return null;
    }

    return payload;
  } catch {
    clearJwt();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build the backend URL for OAuth redirect
// ---------------------------------------------------------------------------

export function getBackendAuthUrl(): string {
  if (useDevProxy) {
    return "/oauth2/authorization/google";
  }
  return `${env.VITE_BACKEND_URL}/oauth2/authorization/google`;
}

// ---------------------------------------------------------------------------
// Helper to get the Authorization header value for API calls
// ---------------------------------------------------------------------------

export function getAuthHeader(): string | null {
  const token = getJwt();
  return token ? `Bearer ${token}` : null;
}
