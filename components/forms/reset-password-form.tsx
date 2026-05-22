"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "blocked" | "invalid";

async function resolveRecoveryState() {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "invalid" as const,
      message: "O link de recuperação é inválido ou expirou. Solicite um novo e-mail."
    };
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

    return {
      status: "blocked" as const,
      message: "Acesso bloqueado. Entre em contato com a coordenação."
    };
  }

  return {
    status: "ready" as const,
    message: null
  };
}

interface ResetPasswordFormProps {
  flow?: string;
}

export function ResetPasswordForm({ flow }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadRecoveryState() {
      if (flow !== "recovery") {
        if (!isMounted) {
          return;
        }

        setRecoveryState("invalid");
        setRecoveryMessage(
          "O link de recuperação é inválido ou expirou. Solicite um novo e-mail."
        );
        return;
      }

      try {
        const result = await resolveRecoveryState();

        if (!isMounted) {
          return;
        }

        setRecoveryState(result.status);
        setRecoveryMessage(result.message);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRecoveryState("invalid");
        setRecoveryMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível validar a recuperação de senha."
        );
      }
    }

    void loadRecoveryState();

    return () => {
      isMounted = false;
    };
  }, [flow]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("A confirmação de senha deve ser igual à nova senha.");
      return;
    }

    startTransition(async () => {
      try {
        const recoveryStatus = await resolveRecoveryState();

        if (recoveryStatus.status !== "ready") {
          setRecoveryState(recoveryStatus.status);
          setRecoveryMessage(recoveryStatus.message);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({
          password
        });

        if (error) {
          throw error;
        }

        await supabase.auth.signOut();
        router.replace("/login?auth_notice=password-updated");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível redefinir a senha."
        );
      }
    });
  }

  return (
    <div className="login-card">
      <div className="login-copy">
        <p className="eyebrow">Redefinição segura</p>
        <h1>Definir nova senha</h1>
        <p>
          Crie uma nova senha para concluir a recuperação do seu acesso
          institucional.
        </p>
      </div>

      {recoveryState === "checking" ? (
        <div className="form-stack">
          <p className="form-notice">Validando o link de recuperação...</p>
        </div>
      ) : recoveryState === "ready" ? (
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nova senha</span>
            <input
              className="input"
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span>Confirmar nova senha</span>
            <input
              className="input"
              type="password"
              placeholder="********"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      ) : (
        <div className="form-stack">
          {recoveryMessage ? (
            <p className="form-notice form-notice-error">{recoveryMessage}</p>
          ) : null}
        </div>
      )}

      <div className="auth-inline-links">
        <Link className="text-link" href="/login">
          Voltar para o login
        </Link>
        <Link className="text-link" href="/esqueci-senha">
          Solicitar novo link
        </Link>
      </div>
    </div>
  );
}





