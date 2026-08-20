import { google } from "googleapis";

export type RawJob = {
  source: string;
  title: string;
  company: string;
  location: string;
  region: string;
  url: string;
  description: string;
  posted_at: string;
};

// Clasifica la ubicación (y si hace falta la descripción) en una macro-región,
// para que sea fácil descartar de un vistazo ofertas fuera de zona horaria/
// interés (ej. EEUU cuando buscas algo compatible con Europa).
const REGION_KEYWORDS: { region: string; terms: string[] }[] = [
  {
    region: "LATAM",
    terms: [
      "latam",
      "latin america",
      "latinoamérica",
      "sudamérica",
      "south america",
      "mexico",
      "méxico",
      "argentina",
      "colombia",
      "chile",
      "peru",
      "perú",
      "brazil",
      "brasil",
      "ecuador",
      "uruguay",
      "venezuela",
      "costa rica",
      "panama",
      "panamá",
    ],
  },
  {
    region: "EEUU/Norteamérica",
    terms: [
      "united states",
      "usa",
      "u.s.",
      "us only",
      "estados unidos",
      "eeuu",
      "canada",
      "canadá",
      "california",
      "new york",
      "texas",
      "seattle",
      "san francisco",
      "austin",
      "boston",
      "chicago",
    ],
  },
  {
    region: "Asia/Pacífico",
    terms: [
      "asia",
      "apac",
      "india",
      "china",
      "japan",
      "japón",
      "singapore",
      "singapur",
      "philippines",
      "filipinas",
      "australia",
      "new zealand",
      "nueva zelanda",
      "vietnam",
      "indonesia",
      "malaysia",
      "hong kong",
      "korea",
      "corea",
    ],
  },
  {
    region: "EMEA",
    terms: [
      "spain",
      "españa",
      "madrid",
      "barcelona",
      "valladolid",
      "valencia",
      "sevilla",
      "bilbao",
      "europe",
      "europa",
      "emea",
      "united kingdom",
      "uk",
      "london",
      "germany",
      "alemania",
      "berlin",
      "france",
      "francia",
      "paris",
      "italy",
      "italia",
      "portugal",
      "lisbon",
      "netherlands",
      "holanda",
      "ireland",
      "irlanda",
      "poland",
      "polonia",
      "belgium",
      "bélgica",
      "switzerland",
      "suiza",
      "sweden",
      "suecia",
      "africa",
      "áfrica",
      "middle east",
      "dubai",
      "emirates",
    ],
  },
];

export function classifyRegion(...texts: string[]): string {
  const haystack = texts.join(" ").toLowerCase();
  for (const { region, terms } of REGION_KEYWORDS) {
    if (terms.some((term) => haystack.includes(term))) return region;
  }
  return "Global / No especificada";
}

export async function fetchRemotiveJobs(
  keywords: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const params = new URLSearchParams();
  if (keywords.trim()) params.set("search", keywords);

  const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": "JobSearchCopilot/1.0" } });
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
      region: classifyRegion(j.candidate_required_location, j.title),
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
      region: classifyRegion(j.location ?? "", j.title),
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
      region: classifyRegion(j.location ?? "", j.description),
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
      region: classifyRegion(j.location ?? "", j.description ?? ""),
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.date ?? "",
    }));
}

export async function fetchWeWorkRemotelyJobs(
  roles: string[],
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const res = await fetch("https://weworkremotely.com/remote-jobs.rss", {
    headers: { "User-Agent": "JobSearchCopilot/1.0" },
  });
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
      region: classifyRegion(description),
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
      region: classifyRegion(j.location ?? "", j.description ?? ""),
      url: j.url,
      description: stripHtml(j.description ?? ""),
      posted_at: j.pub_date ?? "",
    }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---- Alertas por email (Gmail) ----
// No es scraping de InfoJobs/Tecnoempleo: son las alertas que el propio
// usuario configuró en esos portales, leídas de su propia bandeja de Gmail
// vía la API oficial (con su permiso de solo lectura). Los enlaces de estos
// proveedores son de tracking (redirigen a la oferta real al hacer clic),
// así que se usan tal cual para el campo url.

const EMAIL_ALERT_MAX_MESSAGES = 10;

type GmailMessagePart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailMessagePart[] | null;
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function findMimePart(part: GmailMessagePart | null | undefined, mimeType: string): string {
  if (!part) return "";
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findMimePart(child, mimeType);
    if (found) return found;
  }
  return "";
}

async function fetchGmailMessageBodies(
  accessToken: string,
  query: string,
): Promise<{ html: string; text: string }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: EMAIL_ALERT_MAX_MESSAGES,
  });
  const messages = list.data.messages ?? [];

  const bodies: { html: string; text: string }[] = [];
  for (const m of messages) {
    if (!m.id) continue;
    const msg = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    bodies.push({
      html: findMimePart(msg.data.payload, "text/html"),
      text: findMimePart(msg.data.payload, "text/plain"),
    });
  }
  return bodies;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchInfoJobsEmailAlerts(
  accessToken: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const days = maxDaysOld && maxDaysOld > 0 ? maxDaysOld : 30;
  let bodies: { html: string; text: string }[];
  try {
    bodies = await fetchGmailMessageBodies(
      accessToken,
      `from:ofertas@push.infojobs.net newer_than:${days}d`,
    );
  } catch (e) {
    console.error("InfoJobs (email) error", e);
    return [];
  }

  // Cada bloque de oferta en el HTML del email: enlace+título, empresa y
  // ubicación, en ese orden, separados por el resto del maquetado de la tabla.
  const jobBlockRe =
    /<a href="(https:\/\/link\.push\.infojobs\.net\/ls\/click\?[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]{0,400}?<td class="text"[^>]*>([^<]+)<\/td>[\s\S]{0,400}?<span>\s*<span>([^<]+)<\/span>/g;

  const jobs: RawJob[] = [];
  for (const { html } of bodies) {
    if (!html) continue;
    for (const match of html.matchAll(jobBlockRe)) {
      const [, url, rawTitle, rawCompany, rawLocation] = match;
      const title = decodeHtmlEntities(rawTitle);
      const company = decodeHtmlEntities(rawCompany);
      const location = decodeHtmlEntities(rawLocation);
      if (!title || jobs.some((j) => j.url === url)) continue;
      jobs.push({
        source: "infojobs-email",
        title,
        company,
        location,
        region: classifyRegion(location),
        url,
        description: `${title} — ${company} (${location})`,
        posted_at: "",
      });
    }
  }
  return jobs;
}

// El enlace de tracking.php lleva un JWT (sin cifrar, solo firmado) en el
// parámetro cid con la URL real de destino dentro — se decodifica para tener
// una URL estable y así deduplicar correctamente entre alertas repetidas.
function decodeTecnoempleoDestUrl(trackingUrl: string): string {
  try {
    const cid = new URL(trackingUrl).searchParams.get("cid");
    if (!cid) return trackingUrl;
    const payloadB64 = cid.split(".")[1];
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as { dest?: string };
    return typeof payload.dest === "string" ? payload.dest : trackingUrl;
  } catch {
    return trackingUrl;
  }
}

const LINKEDIN_NOISE_LINES = new Set([
  "esta empresa busca personal activamente",
  "solicitar con perfil y cv",
  "fácil solicitud",
  "empleo destacado",
]);

export async function fetchLinkedInEmailAlerts(
  accessToken: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const days = maxDaysOld && maxDaysOld > 0 ? maxDaysOld : 30;
  let bodies: { html: string; text: string }[];
  try {
    bodies = await fetchGmailMessageBodies(
      accessToken,
      `from:jobalerts-noreply@linkedin.com newer_than:${days}d`,
    );
  } catch (e) {
    console.error("LinkedIn (email) error", e);
    return [];
  }

  const jobs: RawJob[] = [];
  for (const { text } of bodies) {
    if (!text) continue;
    // Cada oferta va separada por una línea de guiones en el email de alerta.
    for (const block of text.split(/-{10,}/)) {
      const lines = block
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const urlLineIdx = lines.findIndex((l) => l.startsWith("Ver anuncio de empleo:"));
      if (urlLineIdx === -1) continue;
      const rawUrlMatch = lines[urlLineIdx].match(/Ver anuncio de empleo:\s*(\S+)/);
      if (!rawUrlMatch) continue;

      // LinkedIn ya da la URL real del puesto (no de tracking); se le quitan
      // los parámetros de campaña para tener un enlace estable y deduplicar
      // bien entre alertas repetidas.
      const idMatch = rawUrlMatch[1].match(/\/jobs\/view\/(\d+)/);
      const url = idMatch ? `https://www.linkedin.com/jobs/view/${idMatch[1]}` : rawUrlMatch[1];

      // Justo antes de la línea de la URL van, en este orden, título, empresa
      // y ubicación — con líneas de relleno variables ("Solicitar con perfil
      // y CV", "3 contactos"...) que se filtran antes de tomar las 3 últimas.
      const preceding = lines
        .slice(0, urlLineIdx)
        .filter(
          (l) => !LINKEDIN_NOISE_LINES.has(l.toLowerCase()) && !/^\d+\s+contactos?$/i.test(l),
        );
      if (preceding.length < 3) continue;
      const location = preceding[preceding.length - 1];
      const company = preceding[preceding.length - 2];
      const title = preceding[preceding.length - 3];
      if (!title || jobs.some((j) => j.url === url)) continue;

      jobs.push({
        source: "linkedin-email",
        title,
        company,
        location,
        region: classifyRegion(location),
        // LinkedIn no incluye descripción en el email de alerta: la
        // puntuación de la IA para estas ofertas se basa solo en
        // título/empresa/ubicación.
        description: `${title} — ${company} (${location})`,
        url,
        posted_at: "",
      });
    }
  }
  return jobs;
}

export async function fetchTecnoempleoEmailAlerts(
  accessToken: string,
  maxDaysOld?: number,
): Promise<RawJob[]> {
  const days = maxDaysOld && maxDaysOld > 0 ? maxDaysOld : 30;
  let bodies: { html: string; text: string }[];
  try {
    bodies = await fetchGmailMessageBodies(
      accessToken,
      `from:alertas@push.tecnoempleo.com newer_than:${days}d`,
    );
  } catch (e) {
    console.error("Tecnoempleo (email) error", e);
    return [];
  }

  // La parte de texto plano del email trae cada oferta en 2 líneas: enlace de
  // tracking + título, y luego "Empresa - Ubicación" (con "Nueva" opcional).
  const jobBlockRe =
    /^ {0,2}(https:\/\/www\.tecnoempleo\.com\/tracking\.php\?cid=[\w.-]+) +(.+?) *\r?\n(.+?) - (.+?)(?:&nbsp;&nbsp;Nueva)? *\r?\n/gm;

  const jobs: RawJob[] = [];
  for (const { text } of bodies) {
    if (!text) continue;
    for (const match of text.matchAll(jobBlockRe)) {
      const [, trackingUrl, rawTitle, rawCompany, rawLocation] = match;
      const title = decodeHtmlEntities(rawTitle);
      const company = decodeHtmlEntities(rawCompany);
      const location = decodeHtmlEntities(rawLocation);
      const url = decodeTecnoempleoDestUrl(trackingUrl);
      if (!title || jobs.some((j) => j.url === url)) continue;
      jobs.push({
        source: "tecnoempleo-email",
        title,
        company,
        location,
        region: classifyRegion(location),
        url,
        description: `${title} — ${company} (${location})`,
        posted_at: "",
      });
    }
  }
  return jobs;
}
