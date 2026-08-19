"use client";

import { useEffect, useMemo, useState } from "react";
import GenerateModal from "@/components/GenerateModal";

export type Job = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  fetched_at: string;
  score: string;
  score_reasoning: string;
  status: string;
};

type JobMode = "any" | "remote" | "hybrid" | "onsite";

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  seen: "Visto",
  saved: "Guardado",
  applied: "Aplicado",
  discarded: "Descartado",
};

const MODE_LABELS: Record<JobMode, string> = {
  any: "Cualquiera",
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

function scoreColor(score: number) {
  if (score >= 75) return "bg-accent/15 text-accent";
  if (score >= 50) return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5 9.5 18 20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M19 15.5 19.8 17.5 21.8 18.3 19.8 19.1 19 21.1 18.2 19.1 16.2 18.3 18.2 17.5 19 15.5Z" fill="currentColor" />
    </svg>
  );
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [maxDaysOld, setMaxDaysOld] = useState(30);
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<JobMode>("any");

  async function fetchJobs(): Promise<Job[]> {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    return data.jobs ?? [];
  }

  useEffect(() => {
    fetchJobs().then((data) => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  async function handleSearch() {
    setSearching(true);
    setMessage(null);
    // Mientras la búsqueda está en curso, cada oferta se va guardando en el
    // Sheet según se puntúa (ver runJobSearch), así que refrescamos la lista
    // periódicamente para que vayan apareciendo sin esperar a que termine todo.
    const poll = setInterval(() => {
      fetchJobs().then(setJobs);
    }, 3000);
    try {
      const res = await fetch("/api/jobs/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxDaysOld, location, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage(
        data.newJobs > 0
          ? `Se encontraron ${data.newJobs} empleos nuevos.`
          : "No se encontraron empleos nuevos esta vez.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error buscando empleos");
    } finally {
      clearInterval(poll);
      setSearching(false);
      setJobs(await fetchJobs());
    }
  }

  async function updateStatus(job: Job, status: string) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status } : j)));
    await fetch(`/api/jobs/${job.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const newCount = jobs.filter((j) => j.status === "new").length;

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (Number(j.score) < minScore) return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      return true;
    });
  }, [jobs, minScore, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          {newCount > 0 && (
            <p className="mt-0.5 text-sm font-medium text-accent">
              {newCount} empleo{newCount === 1 ? "" : "s"} nuevo{newCount === 1 ? "" : "s"} sin
              revisar
            </p>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          <SearchIcon />
          {searching ? "Buscando…" : "Buscar nuevos empleos"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Ubicación</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej. Madrid (vacío = tu perfil)"
            className="rounded-md border border-border bg-transparent px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Modalidad</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as JobMode)}
            className="rounded-md border border-border bg-transparent px-3 py-1.5"
          >
            {(Object.keys(MODE_LABELS) as JobMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Publicadas en los últimos (días)
          </span>
          <input
            type="number"
            min={1}
            max={90}
            value={maxDaysOld}
            onChange={(e) => setMaxDaysOld(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 rounded-md border border-border bg-transparent px-3 py-1.5"
          />
        </label>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Score mínimo
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="accent-primary"
          />
          <span className="w-8 text-right tabular-nums">{minScore}</span>
        </label>
        <label className="flex items-center gap-2">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-transparent px-2 py-1"
          >
            <option value="all">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay empleos que coincidan. Completa tu perfil y pulsa &quot;Buscar nuevos empleos&quot;.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((job) => (
            <li
              key={job.id}
              className="rounded-xl border border-border bg-card p-4 transition-colors duration-150"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {job.title}
                  </a>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {job.company} · {job.location} · {job.source}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${scoreColor(Number(job.score))}`}
                >
                  {job.score}/100
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{job.score_reasoning}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground">
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
                <button
                  onClick={() => updateStatus(job, "saved")}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 transition-colors duration-150 hover:bg-muted"
                >
                  <BookmarkIcon />
                  Guardar
                </button>
                <button
                  onClick={() => updateStatus(job, "applied")}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 transition-colors duration-150 hover:bg-muted"
                >
                  <CheckIcon />
                  Marcar aplicado
                </button>
                <button
                  onClick={() => updateStatus(job, "discarded")}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 transition-colors duration-150 hover:bg-muted"
                >
                  <XIcon />
                  Descartar
                </button>
                <button
                  onClick={() => setSelectedJob(job)}
                  className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
                >
                  <SparkleIcon />
                  Generar CV + carta
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedJob && (
        <GenerateModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}
