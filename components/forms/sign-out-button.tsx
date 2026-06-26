"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutClientSession } from "@/lib/auth/client-session";

export function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await signOutClientSession(router);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível encerrar a sessão."
        );
      }
    });
  }

  return (
    <div className="form-stack">
      <button className="button button-secondary" type="button" onClick={handleSignOut}>
        {isPending ? "Saindo..." : "Sair"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}


