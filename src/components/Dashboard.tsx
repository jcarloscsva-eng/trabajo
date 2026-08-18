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

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  seen: "Visto",
  saved: "Guardado",
  applied: "Aplicado",
  discarded: "Descartado",
};

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/jobs/fetch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage(
        data.newJobs > 0
          ? `Se encontraron ${data.newJobs} empleos nuevos.`
          : "No se encontraron empleos nuevos esta vez.",
      );
      setJobs(await fetchJobs());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error buscando empleos");
    } finally {
      setSearching(false);
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
          <h1 className="text-xl font-semibold">Dashboard</h1>
          {newCount > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {newCount} empleo{newCount === 1 ? "" : "s"} nuevo{newCount === 1 ? "" : "s"} sin
              revisar
            </p>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {searching ? "Buscando…" : "Buscar nuevos empleos"}
        </button>
      </div>

      {message && <p className="text-sm opacity-80">{message}</p>}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Score mínimo
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
          <span>{minScore}</span>
        </label>
        <label className="flex items-center gap-2">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
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
        <p className="opacity-60">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="opacity-60">
          No hay empleos que coincidan. Completa tu perfil y pulsa &quot;Buscar nuevos empleos&quot;.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((job) => (
            <li
              key={job.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {job.title}
                  </a>
                  <p className="text-sm opacity-70">
                    {job.company} · {job.location} · {job.source}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreColor(Number(job.score))}`}
                >
                  {job.score}/100
                </span>
              </div>
              <p className="mt-2 text-sm opacity-80">{job.score_reasoning}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-black/5 px-2 py-1 dark:bg-white/10">
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
                <button
                  onClick={() => updateStatus(job, "saved")}
                  className="rounded-md border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Guardar
                </button>
                <button
                  onClick={() => updateStatus(job, "applied")}
                  className="rounded-md border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Marcar aplicado
                </button>
                <button
                  onClick={() => updateStatus(job, "discarded")}
                  className="rounded-md border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Descartar
                </button>
                <button
                  onClick={() => setSelectedJob(job)}
                  className="ml-auto rounded-md bg-foreground px-3 py-1 font-medium text-background hover:opacity-90"
                >
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
