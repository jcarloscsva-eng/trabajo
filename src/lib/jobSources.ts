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

export async function fetchRemotiveJobs(keywords: string): Promise<RawJob[]> {
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
  return ((data.jobs ?? []) as RemotiveJob[]).slice(0, 20).map((j) => ({
    source: "remotive",
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    url: j.url,
    description: stripHtml(j.description ?? ""),
    posted_at: j.publication_date ?? "",
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
