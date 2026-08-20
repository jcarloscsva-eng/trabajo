"use client";

import { useState } from "react";
import type { Job } from "@/components/Dashboard";

type Result = { tailoredCv: string; coverLetter: string; tailoredCvHtml?: string };

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 15V6a1.5 1.5 0 0 1 1.5-1.5H15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      // Un timeout de la plataforma (más de maxDuration) devuelve una página
      // de error en vez de JSON: se trata como fallo en vez de dejar que
      // res.json() reviente con un mensaje críptico.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? `Error generando materiales (HTTP ${res.status})`);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{job.title}</h2>
            <p className="text-sm text-muted-foreground">{job.company}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted"
          >
            <CloseIcon />
          </button>
        </div>

        {!result && !loading && (
          <button
            onClick={generate}
            className="flex items-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <SparkleIcon />
            Generar CV adaptado y cover letter
          </button>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Generando con IA…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              {result.tailoredCvHtml && (
                <button
                  onClick={() => setTab("visual")}
                  className={`rounded-md px-3 py-1 transition-colors duration-150 ${tab === "visual" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
                >
                  CV visual
                </button>
              )}
              <button
                onClick={() => setTab("cv")}
                className={`rounded-md px-3 py-1 transition-colors duration-150 ${tab === "cv" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
              >
                CV ATS (texto)
              </button>
              <button
                onClick={() => setTab("letter")}
                className={`rounded-md px-3 py-1 transition-colors duration-150 ${tab === "letter" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
              >
                Cover letter
              </button>
              <div className="ml-auto flex gap-2">
                {tab === "visual" && result.tailoredCvHtml && (
                  <button
                    onClick={downloadHtml}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 transition-colors duration-150 hover:bg-muted"
                  >
                    <DownloadIcon />
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
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 transition-colors duration-150 hover:bg-muted"
                >
                  <CopyIcon />
                  Copiar
                </button>
              </div>
            </div>

            {tab === "visual" && result.tailoredCvHtml ? (
              <iframe
                srcDoc={result.tailoredCvHtml}
                sandbox=""
                className="flex-1 rounded-md border border-border bg-white"
              />
            ) : (
              <pre className="flex-1 overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap text-foreground">
                {tab === "cv" ? result.tailoredCv : result.coverLetter}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
