# oncall-admin

Frontend de administracion para Oncall (React Router + Vite + TypeScript).

## Requisitos

- Node.js 22+ (recomendado 24)
- npm

## Instalacion

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env` en la raiz usando `.env.example` como base.

Variables disponibles:

- `VITE_BACKEND_URL` (obligatoria): URL base del backend.
- `VITE_USE_DEV_PROXY` (opcional): `true` o `false`.
	- `true` (default): en local usa proxy de Vite para `/api`, `/oauth2` y `/login/oauth2`.
	- `false`: en local llama directo a `VITE_BACKEND_URL`.
- `VITE_DEV_JWT` (opcional): token JWT para desarrollo local.
	- Si existe y no hay token guardado, se guarda automaticamente en `localStorage` como `oncall_jwt`.

## Como activar en local (contra produccion)

1. Configura `.env` asi:

```env
VITE_BACKEND_URL=https://oncall-production-9337.up.railway.app
VITE_USE_DEV_PROXY=true
VITE_DEV_JWT=
```

2. Arranca el frontend:

```bash
npm run dev
```

3. Abre la app en:

- http://localhost:5173

Notas:

- Con `VITE_USE_DEV_PROXY=true`, el navegador habla con `localhost` y Vite reenvia al backend remoto, evitando bloqueo CORS en desarrollo local.
- Si el flujo OAuth del backend productivo redirige al dominio de produccion, usa `VITE_DEV_JWT` para trabajar en local sin depender de ese redirect.
- El aviso visual de modo desarrollo solo se muestra en local (`import.meta.env.DEV`).

## Scripts

- `npm run dev`: entorno local con HMR.
- `npm run build`: build de produccion.
- `npm run start`: sirve el build generado.
- `npm run typecheck`: genera tipos de rutas y valida TypeScript.
- `npm run api:spec`: descarga OpenAPI desde `${VITE_BACKEND_URL}/api-docs` y regenera tipos.
- `npm run api:typecheck`: ejecuta `api:spec` y despues `typecheck`.

## Despliegue

El comportamiento de despliegue se mantiene:

- En build/runtime de produccion se usa `VITE_BACKEND_URL` como URL absoluta.
- El proxy de Vite solo aplica en desarrollo local.

Build y ejecucion:

```bash
npm run build
npm run start
```

## Docker

```bash
docker build -t oncall-admin --build-arg VITE_BACKEND_URL=https://oncall-production-9337.up.railway.app .
docker run -p 3000:3000 oncall-admin
```
