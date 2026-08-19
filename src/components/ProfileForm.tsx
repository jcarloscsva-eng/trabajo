"use client";

import { useEffect, useState } from "react";

type ProfileData = {
  headline: string;
  skills: string;
  years_experience: string;
  target_roles: string;
  seniority: string;
  locations: string;
  keywords: string;
  max_days_old: string;
  base_cv_text: string;
  cv_html_template: string;
};

const EMPTY: ProfileData = {
  headline: "",
  skills: "",
  years_experience: "",
  target_roles: "",
  seniority: "",
  locations: "",
  keywords: "",
  max_days_old: "30",
  base_cv_text: "",
  cv_html_template: "",
};

const FIELDS: { key: keyof ProfileData; label: string; placeholder: string }[] = [
  { key: "headline", label: "Titular profesional", placeholder: "Ej. Product Manager senior" },
  { key: "skills", label: "Skills clave", placeholder: "Ej. SQL, roadmapping, A/B testing" },
  { key: "years_experience", label: "Años de experiencia", placeholder: "Ej. 6" },
  { key: "target_roles", label: "Roles objetivo", placeholder: "Ej. Product Manager, Product Owner" },
  { key: "seniority", label: "Seniority", placeholder: "Ej. Senior" },
  { key: "locations", label: "Ubicaciones preferidas", placeholder: "Ej. Madrid, remoto" },
  { key: "keywords", label: "Palabras clave de búsqueda", placeholder: "Ej. product manager saas" },
  {
    key: "max_days_old",
    label: "Antigüedad máxima por defecto (días)",
    placeholder: "Ej. 30",
  },
];

export default function ProfileForm() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile(d.profile);
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setMessage("Perfil guardado.");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "cv" | "template") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setMessage(
        kind === "template"
          ? `Plantilla visual subida (${data.chars} caracteres).`
          : `CV subido y procesado (${data.chars} caracteres).`,
      );
      const refreshed = await fetch("/api/profile").then((r) => r.json());
      if (refreshed.profile) setProfile(refreshed.profile);
    } else {
      setMessage(data.error ?? "Error subiendo el archivo");
    }
  }

  if (loading) return <p className="opacity-60">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Tu perfil</h1>
      <p className="text-sm opacity-70">
        Esta información se usa para buscar empleos afines, puntuar su alineación y adaptar tu
        CV y cover letter.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            {f.label}
            <input
              value={profile[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">CV base (versión ATS, texto plano)</label>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => handleUpload(e, "cv")}
          disabled={uploading}
        />
        {profile.base_cv_text && (
          <p className="text-xs opacity-60">
            CV actual cargado: {profile.base_cv_text.length} caracteres.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        O pega el texto de tu CV directamente
        <textarea
          value={profile.base_cv_text}
          onChange={(e) => setProfile({ ...profile, base_cv_text: e.target.value })}
          rows={10}
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 font-mono text-xs dark:border-white/15"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Plantilla visual de CV (HTML, opcional)
        </label>
        <p className="text-xs opacity-60">
          Si subes el archivo .html de tu CV con diseño, la app generará también una versión
          visual adaptada a cada oferta (mismo diseño, contenido reordenado y priorizado).
        </p>
        <input
          type="file"
          accept=".html,.htm"
          onChange={(e) => handleUpload(e, "template")}
          disabled={uploading}
        />
        {profile.cv_html_template && (
          <p className="text-xs opacity-60">
            Plantilla actual cargada: {profile.cv_html_template.length} caracteres.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar perfil"}
        </button>
        {message && <p className="text-sm opacity-70">{message}</p>}
      </div>

      <AutomationSetup />
    </div>
  );
}

function AutomationSetup() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setError(null);
    const res = await fetch("/api/setup/refresh-token");
    const data = await res.json();
    if (res.ok) setToken(data.refreshToken);
    else setError(data.error ?? "Error obteniendo el token");
  }

  return (
    <details className="rounded-md border border-black/10 p-4 text-sm dark:border-white/15">
      <summary className="cursor-pointer font-medium">
        Búsqueda automática en segundo plano (opcional)
      </summary>
      <div className="mt-3 flex flex-col gap-2 opacity-80">
        <p>
          Para que la app busque empleos sola cada día (cron) sin que tengas la pestaña abierta,
          copia este token y añádelo como variable de entorno{" "}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">GOOGLE_REFRESH_TOKEN</code>{" "}
          en Vercel, junto con{" "}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">NOTIFY_EMAIL</code> (tu email)
          y <code className="rounded bg-black/5 px-1 dark:bg-white/10">CRON_SECRET</code> (uno
          inventado por ti). Ver README para más detalle.
        </p>
        {!token ? (
          <button
            onClick={reveal}
            className="self-start rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Mostrar mi refresh token
          </button>
        ) : (
          <code className="break-all rounded bg-black/5 p-2 dark:bg-white/10">{token}</code>
        )}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </details>
  );
}
