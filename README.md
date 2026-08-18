# Job Search Copilot

Web app que busca empleos alineados con tu perfil, los puntúa con IA, te avisa cuando
aparecen ofertas nuevas y genera un CV adaptado (ATS) + cover letter por cada puesto que
selecciones. Login con Google, base de datos en tu propio Google Sheet.

## Cómo funciona

- **Login**: OAuth de Google (Auth.js / NextAuth v5). Se piden permisos de Sheets, Drive
  (solo archivos creados por la app) y envío de Gmail.
- **Base de datos**: al iniciar sesión se crea (o reutiliza) una hoja de cálculo llamada
  `Job Search Tracker (App Data)` en tu Google Drive, con pestañas `Jobs` y `Profile`.
- **Búsqueda de empleos**: [Adzuna](https://developer.adzuna.com/) y
  [Remotive](https://remotive.com/api-documentation) (ambas gratuitas). Se puede ampliar
  añadiendo más fuentes en `src/lib/jobSources.ts`.
- **Scoring y generación**: Claude (Anthropic API) puntúa cada oferta 0-100 contra tu
  perfil y, bajo demanda, adapta tu CV base y redacta una cover letter por oferta, en el
  mismo idioma que la oferta. Si subes también la plantilla HTML de tu CV con diseño
  (Perfil → "Plantilla visual de CV"), genera además una versión visual adaptada
  reutilizando ese mismo diseño.
- **Notificaciones**: al pulsar "Buscar nuevos empleos" (o vía el cron opcional) se te
  envía un email a tu propia bandeja con el top de coincidencias nuevas.

## Configuración

1. Copia `.env.example` a `.env.local` y rellena:
   - `AUTH_SECRET`: genera uno con `npx auth secret`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: crea credenciales OAuth en
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo
     "Web application"). Añade como *Authorized redirect URI*:
     `http://localhost:3000/api/auth/callback/google` (y la URL de producción cuando
     despliegues). Habilita las APIs de Google Sheets, Google Drive y Gmail en el
     proyecto de Cloud.
   - `ANTHROPIC_API_KEY`: desde [console.anthropic.com](https://console.anthropic.com).
   - `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`: gratis en
     [developer.adzuna.com](https://developer.adzuna.com/).
2. `npm install`
3. `npm run dev` y entra en [http://localhost:3000](http://localhost:3000).
4. Ve a **Perfil**, completa tus datos, sube tu CV base (PDF/DOCX/TXT) y, opcionalmente,
   la plantilla HTML de tu CV con diseño.
5. En **Dashboard**, pulsa "Buscar nuevos empleos".

## Automatización (búsqueda diaria sin tener la app abierta)

Opcional. Sin esto, la búsqueda solo ocurre cuando pulsas el botón manualmente.

1. Despliega en Vercel (el repo ya incluye `vercel.json` con un cron diario a las 07:00 UTC).
2. En **Perfil → "Búsqueda automática en segundo plano"**, revela tu refresh token.
3. En Vercel, añade las variables de entorno:
   - `GOOGLE_REFRESH_TOKEN`: el token del paso anterior.
   - `NOTIFY_EMAIL`: tu email de Gmail.
   - `CRON_SECRET`: una cadena aleatoria cualquiera (Vercel la envía automáticamente
     como `Authorization: Bearer` en cada ejecución del cron).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Auth.js (Google OAuth) ·
Google Sheets/Drive/Gmail APIs · Claude API (Anthropic) · Vercel (hosting + cron).

## Estructura

```
src/
  app/
    api/            # rutas backend (jobs, cv, profile, auth, cron)
    dashboard/       # listado de empleos + scoring
    profile/         # datos del perfil + subida de CV
  components/         # UI (Dashboard, ProfileForm, GenerateModal, NavBar)
  lib/
    auth.ts           # config de NextAuth / Google OAuth
    sheets.ts          # lectura/escritura del Google Sheet (Jobs, Profile)
    jobSources.ts       # integraciones Adzuna / Remotive
    anthropic.ts         # scoring + generación de CV/cover letter con Claude
    jobSearch.ts          # orquesta búsqueda + scoring + notificación
    gmail.ts               # envío de email de notificación
```
