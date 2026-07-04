/**
 * Script para descargar el OpenAPI spec desde Railway y generar tipos.
 *
 * Uso:
 *   npx tsx scripts/download-spec.ts
 *
 * Requiere VITE_BACKEND_URL en el .env (la carga automáticamente).
 * El spec se descarga desde {VITE_BACKEND_URL}/api-docs.
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Cargar .env manualmente (tsx no lo hace automático)
// ---------------------------------------------------------------------------

function loadEnvFile() {
  const envPath = resolve(".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sepIndex = trimmed.indexOf("=");
      if (sepIndex === -1) continue;
      const key = trimmed.slice(0, sepIndex).trim();
      const value = trimmed.slice(sepIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.error("❌ No se pudo leer .env. Asegúrate de que existe.");
    process.exit(1);
  }
}

loadEnvFile();

const BACKEND_URL = process.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.error(
    "❌ VITE_BACKEND_URL no está definida en el archivo .env",
  );
  process.exit(1);
}

const SPEC_URL = `${BACKEND_URL.replace(/\/+$/, "")}/api-docs`;
const CACHE_DIR = "node_modules/.cache";
const TMP_SPEC = `${CACHE_DIR}/openapi-spec.json`;
const OUTPUT = "app/lib/api/schema.d.ts";

async function main() {
  console.log(`⬇️  Descargando spec desde ${SPEC_URL}...`);

  const response = await fetch(SPEC_URL);
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
  }

  const spec = await response.json();
  console.log("✅ Spec descargado correctamente");

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(TMP_SPEC, JSON.stringify(spec, null, 2));

  console.log(`📝 Generando tipos en ${OUTPUT}...`);

  execSync(
    `npx openapi-typescript "${TMP_SPEC}" --output "${OUTPUT}" --alphabetize`,
    { stdio: "inherit" },
  );

  console.log("✅ Tipos generados correctamente");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
