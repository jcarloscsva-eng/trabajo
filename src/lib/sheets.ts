import { google, sheets_v4 } from "googleapis";

const SPREADSHEET_NAME = "Job Search Tracker (App Data)";

const JOBS_HEADERS = [
  "id",
  "source",
  "title",
  "company",
  "location",
  "region",
  "url",
  "description",
  "posted_at",
  "fetched_at",
  "score",
  "score_reasoning",
  "status",
] as const;

const PROFILE_HEADERS = ["key", "value"] as const;

export type JobRow = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  region: string;
  url: string;
  description: string;
  posted_at: string;
  fetched_at: string;
  score: string;
  score_reasoning: string;
  status: string;
};

export type ProfileData = {
  headline: string;
  skills: string;
  years_experience: string;
  target_roles: string;
  seniority: string;
  locations: string;
  keywords: string;
  max_days_old: string;
  base_cv_text: string;
  cv_html_template: string;
};

const PROFILE_DEFAULTS: ProfileData = {
  headline: "",
  skills: "",
  years_experience: "",
  target_roles: "",
  seniority: "",
  locations: "",
  keywords: "",
  max_days_old: "30",
  base_cv_text: "",
  cv_html_template: "",
};

function clientsFor(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

async function findSpreadsheetId(accessToken: string): Promise<string | null> {
  const { drive } = clientsFor(accessToken);
  const res = await drive.files.list({
    q: `name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createSpreadsheet(accessToken: string): Promise<string> {
  const { sheets } = clientsFor(accessToken);
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SPREADSHEET_NAME },
      sheets: [{ properties: { title: "Jobs" } }, { properties: { title: "Profile" } }],
    },
  });
  const spreadsheetId = res.data.spreadsheetId!;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Jobs!A1",
    valueInputOption: "RAW",
    requestBody: { values: [[...JOBS_HEADERS]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Profile!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [...PROFILE_HEADERS],
        ...Object.entries(PROFILE_DEFAULTS).map(([k, v]) => [k, v]),
      ],
    },
  });

  return spreadsheetId;
}

export async function getOrCreateSpreadsheetId(accessToken: string): Promise<string> {
  const existing = await findSpreadsheetId(accessToken);
  if (existing) return existing;
  return createSpreadsheet(accessToken);
}

export async function readJobs(accessToken: string, spreadsheetId: string): Promise<JobRow[]> {
  const { sheets } = clientsFor(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Jobs!A2:M",
  });
  const rows = res.data.values ?? [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    JOBS_HEADERS.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj as JobRow;
  });
}

export async function appendJobs(
  accessToken: string,
  spreadsheetId: string,
  jobs: JobRow[],
): Promise<void> {
  if (jobs.length === 0) return;
  const { sheets } = clientsFor(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Jobs!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: jobs.map((j) => JOBS_HEADERS.map((h) => j[h] ?? "")),
    },
  });
}

export async function updateJobStatus(
  accessToken: string,
  spreadsheetId: string,
  jobId: string,
  status: string,
): Promise<void> {
  const { sheets } = clientsFor(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Jobs!A2:A",
  });
  const ids = (res.data.values ?? []).map((r) => r[0]);
  const rowIndex = ids.indexOf(jobId);
  if (rowIndex === -1) return;
  const statusCol = JOBS_HEADERS.indexOf("status") + 1;
  const colLetter = columnToLetter(statusCol);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Jobs!${colLetter}${rowIndex + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });
}

function columnToLetter(col: number): string {
  let letter = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

export async function readProfile(
  accessToken: string,
  spreadsheetId: string,
): Promise<ProfileData> {
  const { sheets } = clientsFor(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Profile!A2:B",
  });
  const rows = res.data.values ?? [];
  const data = { ...PROFILE_DEFAULTS };
  for (const [key, value] of rows) {
    if (key in data) (data as Record<string, string>)[key] = value ?? "";
  }
  return data;
}

export async function writeProfile(
  accessToken: string,
  spreadsheetId: string,
  profile: Partial<ProfileData>,
): Promise<void> {
  const { sheets } = clientsFor(accessToken);
  const current = await readProfile(accessToken, spreadsheetId);
  const merged = { ...current, ...profile };
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Profile!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [...PROFILE_HEADERS],
        ...Object.entries(merged).map(([k, v]) => [k, v]),
      ],
    },
  });
}

export type { sheets_v4 };
