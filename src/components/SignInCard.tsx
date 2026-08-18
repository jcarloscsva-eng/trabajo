"use client";

import { signIn } from "next-auth/react";

export default function SignInCard() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
    >
      Entrar con Google
    </button>
  );
}
