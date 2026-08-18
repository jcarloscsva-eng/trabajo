import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { readJobs } from "@/lib/sheets";

export async function GET() {
  try {
    const { accessToken, spreadsheetId } = await requireSession();
    const jobs = await readJobs(accessToken, spreadsheetId);
    jobs.sort((a, b) => Number(b.score) - Number(a.score));
    return NextResponse.json({ jobs });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error leyendo empleos" }, { status: 500 });
  }
}
