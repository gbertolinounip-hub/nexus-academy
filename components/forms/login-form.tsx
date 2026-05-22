"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/common/brand-lockup";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function resolveLoginErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "User is banned") {
      return "Acesso bloqueado. Entre em contato com a coordenação.";
    }

    return error.message;
  }

  return "Não foi possível autenticar.";
}

interface LoginFormProps {
  noticeMessage?: string | null;
}

export function LoginForm({ noticeMessage = null }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw userError ?? new Error("Não foi possível validar a sessão autenticada.");
        }

        const { data: currentUserData, error: currentUserError } = await supabase
          .from("usuarios")
          .select("ativo")
          .eq("id", user.id)
          .maybeSingle();

        if (currentUserError) {
          throw currentUserError;
        }

        const resolvedCurrentUserData = (currentUserData ?? null) as
          | {
              ativo: boolean;
            }
          | null;

        if (resolvedCurrentUserData?.ativo === false) {
          await supabase.auth.signOut();
          throw new Error(
            "Seu cadastro está inativo no momento. Procure a coordenação para reativar o acesso."
          );
        }

        router.replace("/redirecionar");
        router.refresh();
      } catch (error) {
        setErrorMessage(resolveLoginErrorMessage(error));
      }
    });
  }

  return (
    <div className="login-card">
      <div className="login-copy">
        <BrandLockup
          prominent
          eyebrow="Plataforma acadêmica"
          subtitle="Desempenho e gestão de estágios"
        />
        <h1>Acesso institucional</h1>
        <p>Use sua conta institucional para acessar dashboards, avaliações, relatórios e fluxos acadêmicos.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        {noticeMessage ? (
          <p className="form-notice form-notice-success">{noticeMessage}</p>
        ) : null}

        <label className="field">
          <span>E-mail institucional</span>
          <input
            className="input"
            type="email"
            placeholder="nome@ies.edu.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            className="input"
            type="password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </button>

        <div className="auth-inline-links">
          <Link className="text-link" href="/esqueci-senha">
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </div>
  );
}




