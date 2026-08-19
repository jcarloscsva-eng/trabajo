export type RawJob = {
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
};

export async function fetchAdzunaJobs(
  roles: string[],
  location: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const words = [...new Set(roles.join(" ").toLowerCase().split(/\s+/).filter(Boolean))];
  if (!appId || !appKey || words.length === 0) return [];

  const country = process.env.ADZUNA_COUNTRY || "es";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    // "what" exige TODAS las palabras a la vez; con varios roles (ej. "Project
    // Manager, Program Manager") eso da casi cero resultados. "what_or" busca
    // cualquiera de las palabras — más amplio, pero el scoring posterior con IA
    // filtra lo irrelevante, así que conviene pecar de incluir de más.
    what_or: words.join(" "),
    results_per_page: "20",
    content_type: "application/json",
  });
  if (location.trim()) params.set("where", location);
  if (maxDaysOld && maxDaysOld > 0) params.set("max_days_old", String(maxDaysOld));

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const redactedUrl = url.replace(appKey, "REDACTED");
    console.error(`Adzuna error (status ${res.status}) for ${redactedUrl}:`, await res.text());
    return [];
  }
  const data = await res.json();
  type AdzunaResult = {
    title: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    redirect_url: string;
    description: string;
    created: string;
  };
  return ((data.results ?? []) as AdzunaResult[]).map((r) => ({
    source: "adzuna",
    title: r.title,
    company: r.company?.display_name ?? "",
    location: r.location?.display_name ?? "",
    url: r.redirect_url,
    description: r.description ?? "",
    posted_at: r.created ?? "",
  }));
}

export async function fetchRemotiveJobs(
  keywords: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const params = new URLSearchParams();
  if (keywords.trim()) params.set("search", keywords);

  const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Remotive error", await res.text());
    return [];
  }
  const data = await res.json();
  type RemotiveJob = {
    title: string;
    company_name: string;
    candidate_required_location: string;
    url: string;
    description: string;
    publication_date: string;
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  return ((data.jobs ?? []) as RemotiveJob[])
    .filter((j) => !cutoff || new Date(j.publication_date).getTime() >= cutoff)
    .slice(0, 20)
    .map((j) => ({
      source: "remotive",
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location,
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.publication_date ?? "",
    }));
}

export async function fetchJoobleJobs(
  roles: string[],
  location: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY;
  const keywords = roles.join(", ");
  if (!apiKey || !keywords.trim()) return [];

  // La propia documentación de Jooble usa varios puestos separados por comas
  // en un único "keywords" (ej. "Sales Manager, Administrator"), así que no
  // hace falta una petición por rol.
  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, location, page: "1" }),
  });
  if (!res.ok) {
    console.error("Jooble error", await res.text());
    return [];
  }
  const data = await res.json();
  type JoobleJob = {
    title: string;
    company: string;
    location: string;
    link: string;
    snippet: string;
    updated: string;
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  return ((data.jobs ?? []) as JoobleJob[])
    .filter((j) => !cutoff || new Date(j.updated).getTime() >= cutoff)
    .slice(0, 20)
    .map((j) => ({
      source: "jooble",
      title: j.title,
      company: j.company ?? "",
      location: j.location ?? "",
      url: j.link,
      description: j.snippet ?? "",
      posted_at: j.updated ?? "",
    }));
}

// Arbeitnow y RemoteOK no soportan filtrar por palabra clave en su API pública:
// devuelven el listado completo y hay que filtrar en cliente. Se compara contra
// cada rol como frase completa (no palabra por palabra) para no ser ni demasiado
// estricto (todas las palabras a la vez) ni demasiado laxo ("Manager" suelto).
function matchesAnyRole(text: string, roles: string[]): boolean {
  if (roles.length === 0) return true;
  const haystack = text.toLowerCase();
  return roles.some((role) => haystack.includes(role.toLowerCase()));
}

export async function fetchArbeitnowJobs(
  roles: string[],
  maxDaysOld?: number,
  remoteOnly?: boolean,
): Promise<RawJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!res.ok) {
    console.error("Arbeitnow error", await res.text());
    return [];
  }
  const data = await res.json();
  type ArbeitnowJob = {
    title: string;
    company_name: string;
    location: string;
    url: string;
    description: string;
    created_at: number;
    remote: boolean;
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  return ((data.data ?? []) as ArbeitnowJob[])
    .filter((j) => !cutoff || j.created_at * 1000 >= cutoff)
    .filter((j) => remoteOnly === undefined || j.remote === remoteOnly)
    .filter((j) => matchesAnyRole(`${j.title} ${j.description}`, roles))
    .slice(0, 20)
    .map((j) => ({
      source: "arbeitnow",
      title: j.title,
      company: j.company_name ?? "",
      location: j.location ?? "",
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : "",
    }));
}

export async function fetchRemoteOkJobs(
  roles: string[],
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "JobSearchCopilot/1.0" },
  });
  if (!res.ok) {
    console.error("RemoteOK error", await res.text());
    return [];
  }
  const data = await res.json();
  type RemoteOkJob = {
    position: string;
    company: string;
    location?: string;
    url: string;
    description?: string;
    tags?: string[];
    date: string;
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  // El primer elemento del array es un aviso legal, no una oferta.
  return ((data ?? []) as RemoteOkJob[])
    .filter((j) => j.position && j.url)
    .filter((j) => !cutoff || new Date(j.date).getTime() >= cutoff)
    .filter((j) =>
      matchesAnyRole(`${j.position} ${j.description ?? ""} ${(j.tags ?? []).join(" ")}`, roles),
    )
    .slice(0, 20)
    .map((j) => ({
      source: "remoteok",
      title: j.position,
      company: j.company ?? "",
      location: j.location || "Remoto",
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.date ?? "",
    }));
}

export async function fetchWeWorkRemotelyJobs(
  roles: string[],
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const res = await fetch("https://weworkremotely.com/remote-jobs.rss");
  if (!res.ok) {
    console.error("WeWorkRemotely error", await res.text());
    return [];
  }
  const xml = await res.text();
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const jobs: RawJob[] = [];
  for (const [, itemXml] of items) {
    const rawTitle = extractXmlTag(itemXml, "title");
    const link = extractXmlTag(itemXml, "link");
    const description = stripHtml(extractXmlTag(itemXml, "description"));
    const pubDate = extractXmlTag(itemXml, "pubDate");
    if (!rawTitle || !link) continue;
    if (cutoff && pubDate && new Date(pubDate).getTime() < cutoff) continue;

    // El título del feed viene como "Empresa: Puesto".
    const [company, ...rest] = rawTitle.split(":");
    const title = rest.length > 0 ? rest.join(":").trim() : rawTitle;
    if (!matchesAnyRole(`${title} ${description}`, roles)) continue;

    jobs.push({
      source: "weworkremotely",
      title,
      company: rest.length > 0 ? company.trim() : "",
      location: "Remoto",
      url: link,
      description,
      posted_at: pubDate ? new Date(pubDate).toISOString() : "",
    });
    if (jobs.length >= 20) break;
  }
  return jobs;
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  return match[1]
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// API interna de Working Nomads, no documentada oficialmente (usada por su
// propio sitio y por varios scrapers públicos). Puede cambiar sin aviso.
export async function fetchWorkingNomadsJobs(
  roles: string[],
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const res = await fetch("https://www.workingnomads.com/api/exposed_jobs/", {
    headers: { "User-Agent": "JobSearchCopilot/1.0" },
  });
  if (!res.ok) {
    console.error("Working Nomads error", await res.text());
    return [];
  }
  const data = await res.json();
  type WorkingNomadsJob = {
    title: string;
    company_name?: string;
    url: string;
    description?: string;
    location?: string;
    tags?: string[] | string;
    pub_date?: string;
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  return ((Array.isArray(data) ? data : []) as WorkingNomadsJob[])
    .filter((j) => j.title && j.url)
    .filter((j) => !cutoff || !j.pub_date || new Date(j.pub_date).getTime() >= cutoff)
    .filter((j) =>
      matchesAnyRole(
        `${j.title} ${j.description ?? ""} ${
          Array.isArray(j.tags) ? j.tags.join(" ") : (j.tags ?? "")
        }`,
        roles,
      ),
    )
    .slice(0, 20)
    .map((j) => ({
      source: "workingnomads",
      title: j.title,
      company: j.company_name ?? "",
      location: j.location || "Remoto",
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.pub_date ?? "",
    }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
