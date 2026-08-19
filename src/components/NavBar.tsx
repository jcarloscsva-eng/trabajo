"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import Logo from "@/components/Logo";

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <Logo />
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
