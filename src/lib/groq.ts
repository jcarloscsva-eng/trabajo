import Groq from "groq-sdk";
import type { ProfileData } from "./sheets";

// Modelo por defecto de la propia documentación/SDK de Groq. 1.000 peticiones/día
// gratis — bastante más predecible que la cuota de Gemini, que varía por proyecto.
const MODEL = "openai/gpt-oss-20b";

function client() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Generar CV + carta (a diferencia de puntuar, que se hace muchas veces por
// búsqueda) mete de golpe el CV/plantilla base entero: con plantillas HTML
// grandes eso supera el límite de 8.000 tokens/minuto del tier gratuito de
// Groq. Como esta llamada es rara (una por oferta seleccionada, no por
// búsqueda), usa la API de NVIDIA NIM en su lugar — límite por peticiones/
// minuto en vez de por tokens, así que una petición grande y puntual no
// choca contra la cuota. Compatible con el formato de OpenAI.
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

async function nvidiaChatCompletion(options: {
  system: string;
  user: string;
  maxTokens: number;
  jsonMode?: boolean;
}): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      max_tokens: options.maxTokens,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`NVIDIA NIM error (status ${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function scoreJobMatch(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ score: number; reasoning: string }> {
  const groq = client();
  const completion = await groq.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente de búsqueda de empleo. Evalúas qué tan alineada está una oferta " +
          "de trabajo con el perfil de un candidato. Respondes SOLO con JSON válido: " +
          '{"score": <entero 0-100>, "reasoning": "<explicación breve en español, 1-3 frases>"}.',
      },
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

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
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
  const content = await nvidiaChatCompletion({
    maxTokens: 3000,
    jsonMode: true,
    system:
      "Eres un experto en redacción de CVs optimizados para sistemas ATS y cartas de " +
      "presentación. Escribe siempre en el mismo idioma que la descripción de la oferta " +
      "de empleo (si está en inglés, responde en inglés; si está en español, en español; " +
      "si está en otro idioma, responde en ese idioma). Devuelves SOLO JSON válido con el " +
      'formato {"tailoredCv": "<CV adaptado en texto plano, listo para ATS>", ' +
      '"coverLetter": "<carta de presentación breve y personalizada>"}. ' +
      "No inventes experiencia, logros ni empresas que no estén en el CV base: reordena, " +
      "resalta y reformula lo existente para alinearlo con la oferta.",
    user:
      `CV base del candidato:\n${profile.base_cv_text.slice(0, 8000)}\n\n` +
      `Oferta de empleo a la que aplica:\n` +
      `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
      `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
      `Genera un CV adaptado (texto plano, compatible con ATS: sin tablas ni columnas) ` +
      `y una cover letter dirigida a esta oferta, en el idioma de la oferta.`,
  });

  const parsed = parseJsonLenient(content);
  return {
    tailoredCv: String(parsed.tailoredCv ?? ""),
    coverLetter: String(parsed.coverLetter ?? ""),
  };
}

async function generateTailoredHtmlCv(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<string> {
  const content = await nvidiaChatCompletion({
    maxTokens: 4000,
    system:
      "Eres un experto en diseño de CVs. Te dan una plantilla HTML/CSS ya diseñada con el " +
      "CV actual de un candidato y una nueva oferta de empleo. Debes devolver un documento " +
      "HTML COMPLETO que reutilice EXACTAMENTE la misma estructura, clases CSS y estilos de " +
      "la plantilla (no cambies el diseño), pero con el contenido (resumen, competencias " +
      "destacadas, orden y énfasis de logros) adaptado para maximizar el encaje con la nueva " +
      "oferta. No inventes experiencia, logros, empresas ni fechas que no estén ya en la " +
      "plantilla: puedes reordenar, resaltar y reformular lo existente. Escribe el contenido " +
      "en el mismo idioma que la descripción de la oferta. Responde ÚNICAMENTE con el HTML " +
      "completo (empezando en <!DOCTYPE html>), sin explicaciones ni bloques de código markdown.",
    user:
      `Plantilla HTML actual del CV:\n${profile.cv_html_template.slice(0, 40000)}\n\n` +
      `Oferta de empleo a la que aplica:\n` +
      `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
      `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
      `Devuelve el HTML completo del CV adaptado, con el mismo diseño.`,
  });

  return extractHtml(content);
}

// No hay garantía de que NIM respete response_format:json_object para todos
// los modelos (depende del motor que sirva a cada uno) — si lo ignora, el
// modelo suele devolver el JSON envuelto en un bloque de código markdown en
// vez de texto libre puro. Se intenta ambas formas antes de rendirse, y si
// falla del todo se lanza un error con un trozo de la respuesta real para
// que quede claro en los logs qué pasó, en vez de un SyntaxError pelado.
function parseJsonLenient(text: string): { tailoredCv?: string; coverLetter?: string } {
  try {
    return JSON.parse(text || "{}");
  } catch {
    // sigue abajo
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // sigue abajo
    }
  }
  throw new Error(
    `NVIDIA NIM no devolvió JSON válido para el CV/carta. Respuesta recibida: ${text.slice(0, 300)}`,
  );
}

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("<!DOCTYPE");
  return start === -1 ? text.trim() : text.slice(start).trim();
}
