"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Job Search Copilot
        </Link>
        {session && (
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className={pathname === "/dashboard" ? "font-medium" : "opacity-70 hover:opacity-100"}
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className={pathname === "/profile" ? "font-medium" : "opacity-70 hover:opacity-100"}
            >
              Perfil
            </Link>
          </nav>
        )}
        <div className="text-sm">
          {status === "loading" ? null : session ? (
            <button
              onClick={() => signOut()}
              className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Salir ({session.user?.email})
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-foreground px-3 py-1.5 text-background hover:opacity-90"
            >
              Entrar con Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
