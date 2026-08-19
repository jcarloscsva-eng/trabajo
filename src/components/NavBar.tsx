"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className="text-primary"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Job Search Copilot
        </Link>
        {session && (
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className={`rounded-md px-3 py-1.5 transition-colors duration-150 ${
                pathname === "/dashboard"
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className={`rounded-md px-3 py-1.5 transition-colors duration-150 ${
                pathname === "/profile"
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Perfil
            </Link>
          </nav>
        )}
        <div className="text-sm">
          {status === "loading" ? null : session ? (
            <button
              onClick={() => signOut()}
              className="rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted"
            >
              Salir ({session.user?.email})
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
            >
              Entrar con Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
