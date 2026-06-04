"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicAppUrl } from "@/lib/supabase/config";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const publicAppUrl = getPublicAppUrl() ?? window.location.origin;
        const redirectUrl = new URL("/auth/callback", publicAppUrl);
        redirectUrl.searchParams.set("next", "/redefinir-senha?flow=recovery");

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl.toString()
        });

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "Se o e-mail estiver cadastrado, enviaremos um link seguro para redefinição de senha."
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível solicitar a recuperação de senha."
        );
      }
    });
  }

  return (
    <div className="login-card">
      <div className="login-copy">
        <p className="eyebrow">Recuperação de senha</p>
        <h1>Esqueci minha senha</h1>
        <p>
          Informe seu e-mail institucional para receber um link seguro de
          redefinição.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>E-mail institucional</span>
          <input
            className="input"
            type="email"
            placeholder="nome@ies.edu.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {successMessage ? (
          <p className="form-notice form-notice-success">{successMessage}</p>
        ) : null}

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        <div className="auth-inline-links">
          <Link className="text-link" href="/login">
            Voltar para o login
          </Link>
        </div>
      </form>
    </div>
  );
}



