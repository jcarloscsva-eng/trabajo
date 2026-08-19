import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { getOrCreateSpreadsheetId } from "@/lib/sheets";
import { runJobSearch, refreshGoogleAccessToken } from "@/lib/jobSearch";

export const maxDuration = 60;

// Triggered from the dashboard "Buscar nuevos empleos" button (uses the logged-in session).
export async function POST(request: Request) {
  try {
    const { accessToken, email, spreadsheetId } = await requireSession();
    const body = await request.json().catch(() => ({}));
    const maxDaysOld = Number(body?.maxDaysOld) || undefined;
    const result = await runJobSearch(accessToken, email, spreadsheetId, maxDaysOld);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error buscando empleos" }, { status: 500 });
  }
}

// Triggered by the Vercel Cron job for unattended background searches. See README for setup.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const email = process.env.NOTIFY_EMAIL;
  if (!refreshToken || !email) {
    return NextResponse.json(
      { error: "Falta GOOGLE_REFRESH_TOKEN o NOTIFY_EMAIL en las variables de entorno" },
      { status: 500 },
    );
  }
  try {
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const spreadsheetId = await getOrCreateSpreadsheetId(accessToken);
    const result = await runJobSearch(accessToken, email, spreadsheetId);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error buscando empleos" }, { status: 500 });
  }
}
