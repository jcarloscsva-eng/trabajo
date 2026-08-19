import { appendJobs, readJobs, readProfile, type JobRow } from "@/lib/sheets";
import { fetchAdzunaJobs, fetchRemotiveJobs } from "@/lib/jobSources";
import { scoreJobMatch } from "@/lib/gemini";
import { sendSelfEmail } from "@/lib/gmail";

export async function runJobSearch(
  accessToken: string,
  email: string,
  spreadsheetId: string,
): Promise<{ newJobs: number }> {
  const profile = await readProfile(accessToken, spreadsheetId);
  const existing = await readJobs(accessToken, spreadsheetId);
  const existingUrls = new Set(existing.map((j) => j.url));

  const keywords = profile.keywords || profile.target_roles;
  const [adzuna, remotive] = await Promise.all([
    fetchAdzunaJobs(keywords, profile.locations),
    fetchRemotiveJobs(keywords),
  ]);

  const candidates = [...adzuna, ...remotive].filter((j) => !existingUrls.has(j.url));

  const scored: JobRow[] = [];
  for (const job of candidates) {
    const { score, reasoning } = await scoreJobMatch(profile, job);
    scored.push({
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
    });
  }

  await appendJobs(accessToken, spreadsheetId, scored);

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
