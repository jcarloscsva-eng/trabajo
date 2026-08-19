import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { readJobs, readProfile } from "@/lib/sheets";
import { generateTailoredMaterials } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { jobId } = (await request.json()) as { jobId: string };
    const { accessToken, spreadsheetId } = await requireSession();

    const [profile, jobs] = await Promise.all([
      readProfile(accessToken, spreadsheetId),
      readJobs(accessToken, spreadsheetId),
    ]);

    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      return NextResponse.json({ error: "Empleo no encontrado" }, { status: 404 });
    }
    if (!profile.base_cv_text.trim()) {
      return NextResponse.json(
        { error: "Sube tu CV base en tu perfil antes de generar uno adaptado" },
        { status: 400 },
      );
    }

    const result = await generateTailoredMaterials(profile, job);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error generando el CV" }, { status: 500 });
  }
}
