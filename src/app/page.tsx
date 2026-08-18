import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInCard from "@/components/SignInCard";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Job Search Copilot</h1>
      <p className="max-w-md text-balance opacity-70">
        Busca empleos alineados con tu perfil, recibe una puntuación de encaje para cada
        oferta y genera en segundos un CV adaptado y una cover letter.
      </p>
      <SignInCard />
    </div>
  );
}
