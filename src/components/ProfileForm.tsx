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

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15V4m0 0L8 8m4-4 4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.2-1.8-.3-.5-.1-1.2.5-1.4.8-.3 1.5.2 2.3.2 2.2 0 4-1.8 4-4A9 9 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

const inputClass =
  "rounded-md border border-border bg-transparent px-3 py-2 transition-colors duration-150 focus:border-primary focus:outline-none";

function SectionCard({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

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
    try {
      const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
      // Un timeout o error de plataforma en Vercel puede devolver HTML/texto
      // en vez de JSON: se trata como fallo en vez de dejar que res.json()
      // reviente sin avisar al usuario.
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setMessage(
          kind === "template"
            ? `Plantilla visual subida (${data.chars} caracteres).`
            : `CV subido y procesado (${data.chars} caracteres).`,
        );
        const refreshed = await fetch("/api/profile").then((r) => r.json());
        if (refreshed.profile) setProfile(refreshed.profile);
      } else {
        setMessage(data?.error ?? `Error subiendo el archivo (HTTP ${res.status})`);
      }
    } catch {
      setMessage("Error de red subiendo el archivo");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta información se usa para buscar empleos afines, puntuar su alineación y adaptar tu
          CV y cover letter.
        </p>
      </div>

      <SectionCard title="Datos de carrera">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm">
              {f.label}
              <input
                value={profile[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="CV base"
        icon={<DocIcon />}
        description="Versión en texto plano optimizada para ATS. Se usa como base para adaptar el CV a cada oferta."
      >
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted">
          <UploadIcon />
          Subir CV (PDF, DOCX o TXT)
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => handleUpload(e, "cv")}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {profile.base_cv_text && (
          <p className="text-xs text-muted-foreground">
            CV actual cargado: {profile.base_cv_text.length} caracteres.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          O pega el texto de tu CV directamente
          <textarea
            value={profile.base_cv_text}
            onChange={(e) => setProfile({ ...profile, base_cv_text: e.target.value })}
            rows={8}
            className={`${inputClass} font-mono text-xs`}
          />
        </label>
      </SectionCard>

      <SectionCard
        title="Plantilla visual de CV"
        icon={<PaletteIcon />}
        description="Opcional. Si subes el archivo .html de tu CV con diseño, la app genera también una versión visual adaptada a cada oferta (mismo diseño, contenido reordenado y priorizado)."
      >
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted">
          <UploadIcon />
          Subir plantilla (.html)
          <input
            type="file"
            accept=".html,.htm"
            onChange={(e) => handleUpload(e, "template")}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {profile.cv_html_template && (
          <p className="text-xs text-muted-foreground">
            Plantilla actual cargada: {profile.cv_html_template.length} caracteres.
          </p>
        )}
      </SectionCard>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar perfil"}
        </button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
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
    <details className="rounded-xl border border-border bg-card p-5 text-sm">
      <summary className="cursor-pointer font-medium">
        Búsqueda automática en segundo plano (opcional)
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
        <p>
          Para que la app busque empleos sola cada día (cron) sin que tengas la pestaña abierta,
          copia este token y añádelo como variable de entorno{" "}
          <code className="rounded bg-muted px-1 text-foreground">GOOGLE_REFRESH_TOKEN</code> en
          Vercel, junto con <code className="rounded bg-muted px-1 text-foreground">NOTIFY_EMAIL</code>{" "}
          (tu email) y <code className="rounded bg-muted px-1 text-foreground">CRON_SECRET</code>{" "}
          (uno inventado por ti). Ver README para más detalle.
        </p>
        {!token ? (
          <button
            onClick={reveal}
            className="self-start rounded-md border border-border px-3 py-1.5 text-foreground transition-colors duration-150 hover:bg-muted"
          >
            Mostrar mi refresh token
          </button>
        ) : (
          <code className="rounded bg-muted p-2 break-all text-foreground">{token}</code>
        )}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </details>
  );
}
