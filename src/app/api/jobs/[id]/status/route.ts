import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { updateJobStatus } from "@/lib/sheets";

export async function PATCH(request: Request, ctx: RouteContext<"/api/jobs/[id]/status">) {
  try {
    const { id } = await ctx.params;
    const { status } = (await request.json()) as { status: string };
    const { accessToken, spreadsheetId } = await requireSession();
    await updateJobStatus(accessToken, spreadsheetId, id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error actualizando estado" }, { status: 500 });
  }
}
