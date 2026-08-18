"use client";

import { useState } from "react";
import type { Job } from "@/components/Dashboard";

type Result = { tailoredCv: string; coverLetter: string; tailoredCvHtml?: string };

export default function GenerateModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"cv" | "letter" | "visual">("cv");

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando materiales");
      setResult(data);
      setTab(data.tailoredCvHtml ? "visual" : "cv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadHtml() {
    if (!result?.tailoredCvHtml) return;
    const blob = new Blob([result.tailoredCvHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CV - ${job.company} - ${job.title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">{job.title}</h2>
            <p className="text-sm opacity-70">{job.company}</p>
          </div>
          <button onClick={onClose} className="text-sm opacity-60 hover:opacity-100">
            Cerrar
          </button>
        </div>

        {!result && !loading && (
          <button
            onClick={generate}
            className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Generar CV adaptado y cover letter
          </button>
        )}

        {loading && <p className="opacity-60">Generando con IA…</p>}
        {error && <p className="text-red-500">{error}</p>}

        {result && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              {result.tailoredCvHtml && (
                <button
                  onClick={() => setTab("visual")}
                  className={`rounded-md px-3 py-1 ${tab === "visual" ? "bg-foreground text-background" : "border border-black/10 dark:border-white/15"}`}
                >
                  CV visual
                </button>
              )}
              <button
                onClick={() => setTab("cv")}
                className={`rounded-md px-3 py-1 ${tab === "cv" ? "bg-foreground text-background" : "border border-black/10 dark:border-white/15"}`}
              >
                CV ATS (texto)
              </button>
              <button
                onClick={() => setTab("letter")}
                className={`rounded-md px-3 py-1 ${tab === "letter" ? "bg-foreground text-background" : "border border-black/10 dark:border-white/15"}`}
              >
                Cover letter
              </button>
              <div className="ml-auto flex gap-2">
                {tab === "visual" && result.tailoredCvHtml && (
                  <button
                    onClick={downloadHtml}
                    className="rounded-md border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                  >
                    Descargar .html
                  </button>
                )}
                <button
                  onClick={() =>
                    copy(
                      tab === "cv"
                        ? result.tailoredCv
                        : tab === "letter"
                          ? result.coverLetter
                          : (result.tailoredCvHtml ?? ""),
                    )
                  }
                  className="rounded-md border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Copiar
                </button>
              </div>
            </div>

            {tab === "visual" && result.tailoredCvHtml ? (
              <iframe
                srcDoc={result.tailoredCvHtml}
                sandbox=""
                className="flex-1 rounded-md border border-black/10 bg-white dark:border-white/15"
              />
            ) : (
              <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-black/5 p-4 text-sm dark:bg-white/5">
                {tab === "cv" ? result.tailoredCv : result.coverLetter}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
