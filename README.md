# Job Search Copilot

Web app que busca empleos alineados con tu perfil, los puntúa con IA, te avisa cuando
aparecen ofertas nuevas y genera un CV adaptado (ATS) + cover letter por cada puesto que
selecciones. Login con Google, base de datos en tu propio Google Sheet.

## Cómo funciona

- **Login**: OAuth de Google (Auth.js / NextAuth v5). Se piden permisos de Sheets, Drive
  (solo archivos creados por la app) y Gmail (envío de notificaciones y lectura para las
  alertas por email — ver más abajo).
- **Base de datos**: al iniciar sesión se crea (o reutiliza) una hoja de cálculo llamada
  `Job Search Tracker (App Data)` en tu Google Drive, con pestañas `Jobs` y `Profile`.
- **Búsqueda de empleos**: [Remotive](https://remotive.com/api-documentation),
  [Jooble](https://jooble.org/api/about), [Arbeitnow](https://www.arbeitnow.com/api/job-board-api),
  [RemoteOK](https://remoteok.com/api), [WeWorkRemotely](https://weworkremotely.com/remote-job-rss-feed)
  (RSS oficial) y Working Nomads (API interna no documentada oficialmente, puede romperse sin
  aviso). Todas gratuitas y sin API key excepto Jooble. Se puede ampliar añadiendo
  más fuentes en `src/lib/jobSources.ts` — se descartó Careerjet porque exige declarar IPs
  fijas de servidor, incompatibles con las funciones serverless de Vercel, y se descartó
  Adzuna porque su WAF bloquea las IPs de los datacenters de Vercel con un error 400,
  incluso con credenciales válidas y la petición bien formada.
- **Alertas por email (LinkedIn / InfoJobs / Tecnoempleo)**: no son integraciones con esos
  portales (no tienen API pública para búsquedas, y no se hace scraping de sus webs — el
  robots.txt de Tecnoempleo, por ejemplo, bloquea explícitamente a los bots de Anthropic).
  En su lugar, la app lee tu propia bandeja de Gmail (permiso de solo lectura,
  `gmail.readonly`) buscando los emails de alertas que tú mismo configuraste en esos
  portales, y extrae las ofertas de ahí. Es tu correo, con tu consentimiento, vía la API
  oficial de Gmail — no accede a nada más. Limitaciones: LinkedIn no incluye descripción
  en el email, así que la puntuación de la IA para esas ofertas se basa solo en
  título/empresa/ubicación; los enlaces de InfoJobs son de tracking (funcionan para abrir
  la oferta, pero dos envíos del mismo puesto pueden no deduplicarse entre sí). Para que
  funcione, configura primero las alertas correspondientes en tu cuenta de LinkedIn/
  InfoJobs/Tecnoempleo con la periodicidad y criterios que quieras.
- **Región del puesto**: cada oferta se clasifica automáticamente (por su ubicación y
  descripción) en una macro-región — EMEA, LATAM, EEUU/Norteamérica, Asia/Pacífico o
  "Global / No especificada" — y se muestra como etiqueta junto a la puntuación, para
  descartar de un vistazo ofertas fuera de tu zona de interés.
- **Scoring y generación**: [Groq](https://groq.com/) (nivel gratuito, modelo
  `llama-3.1-8b-instant`, ~14.400 peticiones/día) puntúa cada oferta 0-100 contra tu
  perfil y, bajo demanda, adapta tu CV base y redacta una cover letter por oferta, en
  el mismo idioma que la oferta. Si subes también la plantilla HTML de tu CV con diseño
  (Perfil → "Plantilla visual de CV"), genera además una versión visual adaptada
  reutilizando ese mismo diseño.
- **Notificaciones**: al pulsar "Buscar nuevos empleos" (o vía el cron opcional) se te
  envía un email a tu propia bandeja con el top de coincidencias nuevas.
- **Parámetros de búsqueda**: desde el Dashboard puedes ajustar por búsqueda la
  ubicación, la modalidad (cualquiera / remoto / híbrido / presencial — en remoto se
  reduce a bolsas 100% remotas, en híbrido/presencial se excluyen) y la antigüedad
  máxima de las ofertas.

## Configuración

1. Copia `.env.example` a `.env.local` y rellena:
   - `AUTH_SECRET`: genera uno con `npx auth secret`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: crea credenciales OAuth en
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo
     "Web application"). Añade como *Authorized redirect URI*:
     `http://localhost:3000/api/auth/callback/google` (y la URL de producción cuando
     despliegues). Habilita las APIs de Google Sheets, Google Drive y Gmail en el
     proyecto de Cloud.
   - `GROQ_API_KEY`: gratis en [console.groq.com/keys](https://console.groq.com/keys)
     (regístrate con email o Google, genera la key al momento).
   - `JOOBLE_API_KEY`: gratis en [jooble.org/api/about](https://jooble.org/api/about)
     (rellena el formulario con tu email, te llega la key al momento).
   - Arbeitnow y RemoteOK no necesitan configuración, se activan solas.
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
Google Sheets/Drive/Gmail APIs · Groq API (Llama) · Vercel (hosting + cron).

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
    jobSources.ts       # integraciones Remotive/Jooble/Arbeitnow/RemoteOK/WWR/WorkingNomads
    groq.ts               # scoring + generación de CV/cover letter con Groq (Llama)
    jobSearch.ts          # orquesta búsqueda + scoring + notificación
    gmail.ts               # envío de email de notificación
```
