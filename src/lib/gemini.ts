import { GoogleGenAI } from "@google/genai";
import type { ProfileData } from "./sheets";

const MODEL = "gemini-2.5-flash";

function client() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function scoreJobMatch(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ score: number; reasoning: string }> {
  const ai = client();
  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      systemInstruction:
        "Eres un asistente de búsqueda de empleo. Evalúas qué tan alineada está una oferta " +
        "de trabajo con el perfil de un candidato. Respondes SOLO con JSON válido: " +
        '{"score": <entero 0-100>, "reasoning": "<explicación breve en español, 1-3 frases>"}.',
      responseMimeType: "application/json",
      maxOutputTokens: 400,
    },
    contents:
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
  });

  try {
    const parsed = JSON.parse(extractJson(response.text ?? "{}"));
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
): Promise<{ tailoredCv: string; coverLetter: string; tailoredCvHtml?: string }> {
  const [text, tailoredCvHtml] = await Promise.all([
    generateTailoredText(profile, job),
    profile.cv_html_template.trim()
      ? generateTailoredHtmlCv(profile, job)
      : Promise.resolve(undefined),
  ]);

  return { ...text, ...(tailoredCvHtml ? { tailoredCvHtml } : {}) };
}

async function generateTailoredText(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ tailoredCv: string; coverLetter: string }> {
  const ai = client();
  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      systemInstruction:
        "Eres un experto en redacción de CVs optimizados para sistemas ATS y cartas de " +
        "presentación. Escribe siempre en el mismo idioma que la descripción de la oferta " +
        "de empleo (si está en inglés, responde en inglés; si está en español, en español; " +
        "si está en otro idioma, responde en ese idioma). Devuelves SOLO JSON válido con el " +
        'formato {"tailoredCv": "<CV adaptado en texto plano, listo para ATS>", ' +
        '"coverLetter": "<carta de presentación breve y personalizada>"}. ' +
        "No inventes experiencia, logros ni empresas que no estén en el CV base: reordena, " +
        "resalta y reformula lo existente para alinearlo con la oferta.",
      responseMimeType: "application/json",
      maxOutputTokens: 3000,
    },
    contents:
      `CV base del candidato:\n${profile.base_cv_text.slice(0, 8000)}\n\n` +
      `Oferta de empleo a la que aplica:\n` +
      `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
      `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
      `Genera un CV adaptado (texto plano, compatible con ATS: sin tablas ni columnas) ` +
      `y una cover letter dirigida a esta oferta, en el idioma de la oferta.`,
  });

  const parsed = JSON.parse(extractJson(response.text ?? "{}"));
  return {
    tailoredCv: String(parsed.tailoredCv ?? ""),
    coverLetter: String(parsed.coverLetter ?? ""),
  };
}

async function generateTailoredHtmlCv(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<string> {
  const ai = client();
  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      systemInstruction:
        "Eres un experto en diseño de CVs. Te dan una plantilla HTML/CSS ya diseñada con el " +
        "CV actual de un candidato y una nueva oferta de empleo. Debes devolver un documento " +
        "HTML COMPLETO que reutilice EXACTAMENTE la misma estructura, clases CSS y estilos de " +
        "la plantilla (no cambies el diseño), pero con el contenido (resumen, competencias " +
        "destacadas, orden y énfasis de logros) adaptado para maximizar el encaje con la nueva " +
        "oferta. No inventes experiencia, logros, empresas ni fechas que no estén ya en la " +
        "plantilla: puedes reordenar, resaltar y reformular lo existente. Escribe el contenido " +
        "en el mismo idioma que la descripción de la oferta. Responde ÚNICAMENTE con el HTML " +
        "completo (empezando en <!DOCTYPE html>), sin explicaciones ni bloques de código markdown.",
      maxOutputTokens: 4000,
    },
    contents:
      `Plantilla HTML actual del CV:\n${profile.cv_html_template.slice(0, 40000)}\n\n` +
      `Oferta de empleo a la que aplica:\n` +
      `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
      `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
      `Devuelve el HTML completo del CV adaptado, con el mismo diseño.`,
  });

  return extractHtml(response.text ?? "");
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return text.slice(start, end + 1);
}

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("<!DOCTYPE");
  return start === -1 ? text.trim() : text.slice(start).trim();
}
