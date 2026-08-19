"use client";

import { signIn } from "next-auth/react";

export default function SignInCard() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="flex items-center gap-2.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#FFF"
          d="M21.35 11.1h-9.17v2.92h5.26c-.23 1.42-1.6 4.17-5.26 4.17-3.17 0-5.76-2.62-5.76-5.85s2.6-5.85 5.76-5.85c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.9 14.66 3 12.18 3 7.13 3 3 7.03 3 12s4.13 9 9.18 9c5.3 0 8.82-3.72 8.82-8.96 0-.6-.07-1.06-.65-1.94Z"
        />
      </svg>
      Entrar con Google
    </button>
  );
}
