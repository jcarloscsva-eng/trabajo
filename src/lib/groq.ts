import Groq from "groq-sdk";
import type { ProfileData } from "./sheets";

// Modelo por defecto de la propia documentación/SDK de Groq. 1.000 peticiones/día
// gratis — bastante más predecible que la cuota de Gemini, que varía por proyecto.
const MODEL = "openai/gpt-oss-20b";

function client() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Solo la plantilla HTML (hasta 40.000 caracteres) supera el límite de 8.000
// tokens/minuto del tier gratuito de Groq — el CV en texto plano (base_cv_text
// + oferta, unos 6.000 tokens en total) cabe de sobra. Por eso únicamente la
// generación del CV visual usa NVIDIA NIM (límite por peticiones/minuto, no
// por tokens); el texto se queda en Groq, que es mucho más rápido.
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
// NVIDIA NIM (modelo comunitario, no el hardware dedicado de Groq) puede
// tardar más de lo que Vercel permite (60s por función). Como el CV visual es
// opcional, se le pone un tope propio bastante por debajo de eso: si tarda
// más, se aborta y el usuario se queda igualmente con el CV+carta en texto
// (que no depende de esta llamada) en vez de que falle toda la generación.
const NVIDIA_TIMEOUT_MS = 45_000;

async function nvidiaChatCompletion(options: {
  system: string;
  user: string;
  maxTokens: number;
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
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
    signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
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
  // Todo envuelto en un único try/catch: si Groq rechaza la generación (su
  // propia validación de JSON puede fallar con ciertos textos, típicamente
  // descripciones "sucias" extraídas de un email de alerta) o si el JSON
  // devuelto no parsea, una sola oferta problemática no debe tirar toda la
  // búsqueda — el resto de candidatos de ese lote se siguen puntuando.
  try {
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

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch (e) {
    console.error("No se pudo puntuar la oferta", job.title, e);
    return { score: 0, reasoning: "No se pudo evaluar automáticamente." };
  }
}

export async function generateTailoredMaterials(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ tailoredCv: string; coverLetter: string; tailoredCvHtml?: string }> {
  const [text, htmlResult] = await Promise.all([
    generateTailoredText(profile, job),
    profile.cv_html_template.trim()
      ? generateTailoredHtmlCv(profile, job).catch((e) => {
          // El CV visual es un extra sobre el CV+carta en texto (que ya se
          // generó arriba con Groq, sin depender de esto): si NVIDIA tarda
          // demasiado o falla, se descarta solo esa parte en vez de tirar
          // toda la generación.
          console.error("No se pudo generar el CV visual", e);
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);

  return { ...text, ...(htmlResult ? { tailoredCvHtml: htmlResult } : {}) };
}

const CV_MARKER = "===CV===";
const COVER_LETTER_MARKER = "===COVER LETTER===";

async function generateTailoredText(
  profile: ProfileData,
  job: { title: string; company: string; description: string },
): Promise<{ tailoredCv: string; coverLetter: string }> {
  // Sin response_format:json_object a propósito: ese modo obliga a Groq a
  // devolver un documento completo y válido o nada — si un CV+oferta grandes
  // se quedan sin presupuesto de tokens a mitad, la petición entera falla
  // (400 json_validate_failed) en vez de devolver lo que llevaba generado.
  // Con texto plano delimitado, un corte a mitad simplemente devuelve el CV
  // completo y la carta truncada (o vacía), pero nunca un error duro — y de
  // paso ahorra tokens: escapar saltos de línea en un string JSON consume
  // más que el texto sin escapar.
  const groq = client();
  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content:
          "Eres un experto en redacción de CVs optimizados para sistemas ATS y cartas de " +
          "presentación. Escribe siempre en el mismo idioma que la descripción de la oferta " +
          "de empleo (si está en inglés, responde en inglés; si está en español, en español; " +
          "si está en otro idioma, responde en ese idioma). Responde ÚNICAMENTE con este " +
          `formato exacto, sin explicaciones ni texto adicional:\n${CV_MARKER}\n<CV adaptado ` +
          `en texto plano, listo para ATS>\n${COVER_LETTER_MARKER}\n<carta de presentación ` +
          "breve y personalizada>\n\n" +
          "No inventes experiencia, logros ni empresas que no estén en el CV base: reordena, " +
          "resalta y reformula lo existente para alinearlo con la oferta.",
      },
      {
        role: "user",
        content:
          `CV base del candidato:\n${profile.base_cv_text.slice(0, 8000)}\n\n` +
          `Oferta de empleo a la que aplica:\n` +
          `- Puesto: ${job.title}\n- Empresa: ${job.company}\n` +
          `- Descripción: ${job.description.slice(0, 4000)}\n\n` +
          `Genera un CV adaptado (texto plano, compatible con ATS: sin tablas ni columnas) ` +
          `y una cover letter dirigida a esta oferta, en el idioma de la oferta.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const cvStart = content.indexOf(CV_MARKER);
  const letterStart = content.indexOf(COVER_LETTER_MARKER);
  if (cvStart === -1) {
    // El modelo no siguió el formato en absoluto: mejor devolver el texto
    // crudo como CV que perder por completo lo que costó generar.
    return { tailoredCv: content.trim(), coverLetter: "" };
  }
  const tailoredCv = content
    .slice(cvStart + CV_MARKER.length, letterStart === -1 ? undefined : letterStart)
    .trim();
  const coverLetter = letterStart === -1 ? "" : content.slice(letterStart + COVER_LETTER_MARKER.length).trim();
  return { tailoredCv, coverLetter };
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

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("<!DOCTYPE");
  return start === -1 ? text.trim() : text.slice(start).trim();
}
