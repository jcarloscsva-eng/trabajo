import { appendJobs, readJobs, readProfile, type JobRow } from "@/lib/sheets";
import {
  fetchAdzunaJobs,
  fetchRemotiveJobs,
  fetchJoobleJobs,
  fetchArbeitnowJobs,
  fetchRemoteOkJobs,
  type RawJob,
} from "@/lib/jobSources";
import { scoreJobMatch } from "@/lib/gemini";
import { sendSelfEmail } from "@/lib/gmail";

// El nivel gratuito de Gemini limita a ~15 peticiones/minuto y Vercel corta la
// función a los 60s, así que en cada ejecución solo puntuamos un lote de ofertas
// nuevas; el resto queda pendiente (no se guarda como "vista") y se recoge en la
// siguiente búsqueda.
const MAX_CANDIDATES_PER_RUN = 12;
const TIME_BUDGET_MS = 45_000;

export type JobMode = "any" | "remote" | "hybrid" | "onsite";

export type JobSearchOptions = {
  maxDaysOld?: number;
  location?: string;
  mode?: JobMode;
};

export async function runJobSearch(
  accessToken: string,
  email: string,
  spreadsheetId: string,
  options: JobSearchOptions = {},
): Promise<{ newJobs: number }> {
  const startedAt = Date.now();
  const profile = await readProfile(accessToken, spreadsheetId);
  const existing = await readJobs(accessToken, spreadsheetId);
  const existingUrls = new Set(existing.map((j) => j.url));
  const daysOld = options.maxDaysOld ?? Number(profile.max_days_old) ?? undefined;
  const location = options.location?.trim() || profile.locations;
  const mode = options.mode ?? "any";

  const keywordsRaw = profile.keywords || profile.target_roles;
  // "Roles objetivo" (y a veces "Palabras clave") suele llevar varios puestos
  // separados por comas, ej. "Project Manager, Program Manager". Adzuna/Jooble
  // interpretan una única cadena como "debe contener TODO eso a la vez", lo que
  // devuelve casi cero resultados. Se busca cada rol por separado y se juntan.
  const roles = keywordsRaw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 5);
  const roleQueries = roles.length > 0 ? roles : [keywordsRaw];

  // Adzuna y Jooble no tienen un filtro booleano de "remoto": se refuerza con
  // la propia palabra clave. Arbeitnow sí trae un campo remote real.
  const remoteSuffix = mode === "remote" ? " remote" : "";
  const arbeitnowRemoteOnly = mode === "remote" ? true : mode === "onsite" ? false : undefined;
  const includeRemoteOnlySources = mode !== "hybrid" && mode !== "onsite";

  const sourcePromises = [
    // Adzuna, Jooble y Remotive filtran server-side: una llamada por rol.
    ...roleQueries.flatMap((role) => [
      fetchAdzunaJobs(`${role}${remoteSuffix}`, location, daysOld),
      fetchJoobleJobs(`${role}${remoteSuffix}`, location, daysOld),
      ...(includeRemoteOnlySources ? [fetchRemotiveJobs(role, daysOld)] : []),
    ]),
    // Arbeitnow y RemoteOK devuelven todo su listado sin filtro server-side:
    // una sola llamada, comparando contra todos los roles en cliente.
    fetchArbeitnowJobs(roleQueries, daysOld, arbeitnowRemoteOnly),
    ...(includeRemoteOnlySources ? [fetchRemoteOkJobs(roleQueries, daysOld)] : []),
  ];

  const results = await Promise.all(sourcePromises);
  // Varias fuentes/roles pueden devolver la misma oferta; se deduplica por URL.
  const seenUrls = new Set<string>();
  const candidates: RawJob[] = [];
  for (const job of results.flat()) {
    if (existingUrls.has(job.url) || seenUrls.has(job.url)) continue;
    seenUrls.add(job.url);
    candidates.push(job);
    if (candidates.length >= MAX_CANDIDATES_PER_RUN) break;
  }

  // Se guarda cada oferta justo tras puntuarla (en vez de esperar a tener el
  // lote completo) para que aparezca en el dashboard casi en tiempo real y
  // para no perder el trabajo ya hecho si la función se corta por tiempo.
  const scored: JobRow[] = [];
  for (const job of candidates) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const { score, reasoning } = await scoreJobMatch(profile, job);
    const row: JobRow = {
      id: crypto.randomUUID(),
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      posted_at: job.posted_at,
      fetched_at: new Date().toISOString(),
      score: String(score),
      score_reasoning: reasoning,
      status: "new",
    };
    scored.push(row);
    await appendJobs(accessToken, spreadsheetId, [row]);
  }

  if (scored.length > 0) {
    const top = [...scored].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 10);
    const body = top
      .map((j) => `${j.score}/100 — ${j.title} @ ${j.company}\n${j.url}\n${j.score_reasoning}\n`)
      .join("\n");
    try {
      await sendSelfEmail(
        accessToken,
        email,
        `${scored.length} nuevos empleos encontrados`,
        `Se encontraron ${scored.length} ofertas nuevas. Top matches:\n\n${body}`,
      );
    } catch (e) {
      console.error("No se pudo enviar el email de notificación", e);
    }
  }

  return { newJobs: scored.length };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`No se pudo refrescar el token: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
