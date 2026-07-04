import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode — the backend (Spring Boot on Railway) handles all OAuth.
  // This frontend only stores the JWT and uses it for API calls.
  ssr: false,
} satisfies Config;
