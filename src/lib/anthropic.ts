import Anthropic from "@anthropic-ai/sdk";
import type { ProfileData } from "./sheets";

const MODEL = "claude-sonnet-4-5-20250929";

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function scoreJobMatch(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ score: number; reasoning: string }> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      "Eres un asistente de búsqueda de empleo. Evalúas qué tan alineada está una oferta " +
      "de trabajo con el perfil de un candidato. Respondes SOLO con JSON válido: " +
      '{"score": <entero 0-100>, "reasoning": "<explicación breve en español, 1-3 frases>"}.',
    messages: [
      {
        role: "user",
        content:
          `Perfil del candidato:\n` +
          `- Titular: ${profile.headline}\n` +
          `- Skills: ${profile.skills}\n` +
          `- Años de experiencia: ${profile.years_experience}\n` +
          `- Roles objetivo: ${profile.target_roles}\n` +
          `- Seniority: ${profile.seniority}\n` +
          `- Ubicaciones preferidas: ${profile.locations}\n\n` +
          `Oferta de empleo:\n` +
          `- Puesto: ${job.title}\n` +
          `- Empresa: ${job.company}\n` +
          `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
          `Puntúa la alineación de 0 a 100 y explica brevemente por qué.`,
      },
    ],
  });

  const text = msg.content.find((c) => c.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(extractJson(text));
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch {
    return { score: 0, reasoning: "No se pudo evaluar automáticamente." };
  }
}

export async function generateTailoredMaterials(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ tailoredCv: string; coverLetter: string }> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system:
      "Eres un experto en redacción de CVs optimizados para sistemas ATS y cartas de " +
      "presentación en español. Devuelves SOLO JSON válido con el formato " +
      '{"tailoredCv": "<CV adaptado en texto plano, listo para ATS>", ' +
      '"coverLetter": "<carta de presentación breve y personalizada>"}. ' +
      "No inventes experiencia, logros ni empresas que no estén en el CV base: reordena, " +
      "resalta y reformula lo existente para alinearlo con la oferta.",
    messages: [
      {
        role: "user",
        content:
          `CV base del candidato:\n${profile.base_cv_text.slice(0, 8000)}\n\n` +
          `Oferta de empleo a la que aplica:\n` +
          `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
          `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
          `Genera un CV adaptado (texto plano, compatible con ATS: sin tablas ni columnas) ` +
          `y una cover letter dirigida a esta oferta.`,
      },
    ],
  });

  const text = msg.content.find((c) => c.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(extractJson(text));
  return {
    tailoredCv: String(parsed.tailoredCv ?? ""),
    coverLetter: String(parsed.coverLetter ?? ""),
  };
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return text.slice(start, end + 1);
}
