"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/common/brand-lockup";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getErrorProperty(error: unknown, property: string) {
  if (typeof error !== "object" || !error) {
    return null;
  }

  const record = error as Record<string, unknown>;
  const value = record[property];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function resolveLoginErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "User is banned") {
      return "Acesso bloqueado. Entre em contato com a coordenação.";
    }

    if (
      error.message === "Invalid login credentials" ||
      error.message === "Invalid authentication credentials"
    ) {
      return "Não foi possível autenticar com o e-mail e a senha informados.";
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
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    setEmail(submittedEmail);
    setPassword(submittedPassword);

    if (!submittedEmail || !submittedPassword) {
      setErrorMessage("Informe e-mail e senha para continuar.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: signInData,
          error
        } = await supabase.auth.signInWithPassword({
          email: submittedEmail,
          password: submittedPassword
        });

        if (error) {
          throw error;
        }

        const user = signInData.user;

        if (!user) {
          throw new Error("Não foi possível validar a sessão autenticada.");
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

        router.replace("/redirecionar?login=1");
        router.refresh();
      } catch (error) {
        console.error("[login] Falha ao autenticar", {
          email: submittedEmail,
          message: error instanceof Error ? error.message : String(error),
          code: getErrorProperty(error, "code"),
          status: getErrorProperty(error, "status")
        });
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
            name="email"
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
            name="password"
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




