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
  keywords: string,
  location: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey || !keywords.trim()) return [];

  const country = process.env.ADZUNA_COUNTRY || "es";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: keywords,
    results_per_page: "20",
    content_type: "application/json",
  });
  if (location.trim()) params.set("where", location);
  if (maxDaysOld && maxDaysOld > 0) params.set("max_days_old", String(maxDaysOld));

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Adzuna error", await res.text());
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
  keywords: string,
  location: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey || !keywords.trim()) return [];

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
// devuelven el listado completo y hay que filtrar en cliente.
function matchesKeywords(text: string, keywords: string): boolean {
  const terms = keywords
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

export async function fetchArbeitnowJobs(
  keywords: string,
  maxDaysOld?: number,
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
  };
  const cutoff =
    maxDaysOld && maxDaysOld > 0 ? Date.now() - maxDaysOld * 24 * 60 * 60 * 1000 : null;

  return ((data.data ?? []) as ArbeitnowJob[])
    .filter((j) => !cutoff || j.created_at * 1000 >= cutoff)
    .filter((j) => matchesKeywords(`${j.title} ${j.description}`, keywords))
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
  keywords: string,
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
      matchesKeywords(`${j.position} ${j.description ?? ""} ${(j.tags ?? []).join(" ")}`, keywords),
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
