import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/requireSession";
import { writeProfile } from "@/lib/sheets";

export const maxDuration = 30;

const MAX_TEMPLATE_CHARS = 40000;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind") === "template" ? "template" : "cv";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { accessToken, spreadsheetId } = await requireSession();

    if (kind === "template") {
      const html = buffer.toString("utf-8").slice(0, MAX_TEMPLATE_CHARS);
      await writeProfile(accessToken, spreadsheetId, { cv_html_template: html });
      return NextResponse.json({ ok: true, chars: html.length });
    }

    const text = await extractText(file.name, buffer);
    await writeProfile(accessToken, spreadsheetId, { base_cv_text: text });
    return NextResponse.json({ ok: true, chars: text.length });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error procesando el archivo" }, { status: 500 });
  }
}

async function extractText(filename: string, buffer: Buffer): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString("utf-8");
}
