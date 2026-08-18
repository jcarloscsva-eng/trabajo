import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { readProfile, writeProfile, type ProfileData } from "@/lib/sheets";

export async function GET() {
  try {
    const { accessToken, spreadsheetId } = await requireSession();
    const profile = await readProfile(accessToken, spreadsheetId);
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error leyendo perfil" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProfileData>;
    const { accessToken, spreadsheetId } = await requireSession();
    await writeProfile(accessToken, spreadsheetId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error guardando perfil" }, { status: 500 });
  }
}
