import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL;
  const useDevProxy = env.VITE_USE_DEV_PROXY !== "false";

  return {
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
      tsconfigPaths: true,
    },
    server:
      useDevProxy && backendUrl
        ? {
            proxy: {
              // API requests stay same-origin in local dev and are proxied to backend.
              "/api": {
                target: backendUrl,
                changeOrigin: true,
                secure: true,
              },
              // OAuth endpoints must also be proxied to avoid CORS in dev.
              "/oauth2": {
                target: backendUrl,
                changeOrigin: true,
                secure: true,
              },
              "/login/oauth2": {
                target: backendUrl,
                changeOrigin: true,
                secure: true,
              },
            },
          }
        : undefined,
  };
});
