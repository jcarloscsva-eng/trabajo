import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInCard from "@/components/SignInCard";

const STEPS = [
  {
    title: "Busca",
    description: "Combina varias bolsas de empleo gratuitas y filtra por antigüedad.",
    icon: (
      <path
        d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: "Puntúa",
    description: "Cada oferta se compara con tu perfil y recibe un score 0-100 con motivo.",
    icon: (
      <path
        d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19l1-5.8-4.3-4.1 5.9-.9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Genera",
    description: "CV adaptado (y cover letter) para el puesto exacto, listo para enviar.",
    icon: (
      <>
        <path
          d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 text-center">
      <div className="flex flex-col items-center gap-6">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
          Copiloto de búsqueda de empleo
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Encuentra el puesto correcto, sin perder horas mirando portales
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Busca empleos alineados con tu perfil, recibe una puntuación de encaje para cada
          oferta y genera en segundos un CV adaptado y una cover letter.
        </p>
        <SignInCard />
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-left sm:items-start"
          >
            <div className="flex items-center gap-2 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {step.icon}
              </svg>
              <span className="text-xs font-semibold text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h2 className="font-semibold">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
