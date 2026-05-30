"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createSupabaseBrowserClient,
  createSupabaseEphemeralBrowserClient
} from "@/lib/supabase/client";

function normalizeUserMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function resolveCurrentPasswordErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "Invalid login credentials" ||
      error.message === "Invalid authentication credentials"
    ) {
      return "A senha atual informada est\u00e1 incorreta.";
    }

    return error.message;
  }

  return "N\u00e3o foi poss\u00edvel validar a senha atual.";
}

function resolvePasswordUpdateErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Auth session missing!") {
      return "Sua sess\u00e3o expirou. Entre novamente para atualizar a senha.";
    }

    return error.message;
  }

  return "N\u00e3o foi poss\u00edvel atualizar a senha.";
}

interface ChangePasswordFormProps {
  email: string;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage(
        "Preencha a senha atual, a nova senha e a confirma\u00e7\u00e3o."
      );
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage("A nova senha deve ser diferente da senha atual.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(
        "A confirma\u00e7\u00e3o de senha deve ser igual \u00e0 nova senha."
      );
      return;
    }

    startTransition(async () => {
      try {
        const verificationClient = createSupabaseEphemeralBrowserClient();
        const { error: verificationError } =
          await verificationClient.auth.signInWithPassword({
            email,
            password: currentPassword
          });

        if (verificationError) {
          setErrorMessage(resolveCurrentPasswordErrorMessage(verificationError));
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
          data: {
            ...normalizeUserMetadata(user?.user_metadata),
            password_change_required: false,
            temporary_password: false
          }
        });

        if (updateError) {
          throw updateError;
        }

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMessage(
          "Sua senha foi atualizada com sucesso. Use a nova senha nos pr\u00f3ximos acessos."
        );
        router.refresh();
      } catch (error) {
        setErrorMessage(resolvePasswordUpdateErrorMessage(error));
      }
    });
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Senha atual</span>
        <input
          className="input"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label className="field">
        <span>Nova senha</span>
        <input
          className="input"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <span className="field-help">{"Use ao menos 8 caracteres."}</span>
      </label>

      <label className="field">
        <span>Confirmar nova senha</span>
        <input
          className="input"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      {successMessage ? (
        <p className="form-notice form-notice-success">{successMessage}</p>
      ) : null}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Atualizando..." : "Atualizar senha"}
      </button>
    </form>
  );
}
