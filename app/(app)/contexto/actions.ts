"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  initialContextSwitchActionState,
  type ContextSwitchActionState
} from "@/app/(app)/contexto/state";

const contextSwitchSchema = z.object({
  contexto_id: z.string().uuid("Selecione um contexto válido.")
});

type ContextSwitchRow = Pick<
  Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"],
  "id" | "usuario_id" | "ativo"
>;

type UserContextDefaultUpdate = Pick<
  Database["public"]["Tables"]["usuarios"]["Update"],
  "contexto_padrao_id"
>;

function buildContextSwitchState(
  state: ContextSwitchActionState,
  patch: Partial<ContextSwitchActionState>
): ContextSwitchActionState {
  return {
    ...state,
    ...patch,
    submittedAt: Date.now()
  };
}

export async function setActiveContextAction(
  _previousState: ContextSwitchActionState,
  formData: FormData
): Promise<ContextSwitchActionState> {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message: "Sessão inválida. Entre novamente para trocar o contexto."
    });
  }

  const parsed = contextSwitchSchema.safeParse({
    contexto_id: formData.get("contexto_id")
  });

  if (!parsed.success) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message:
        parsed.error.flatten().fieldErrors.contexto_id?.[0] ??
        "Selecione um contexto válido.",
      selectedContextId:
        typeof formData.get("contexto_id") === "string"
          ? (formData.get("contexto_id") as string)
          : ""
    });
  }

  const adminClient = createSupabaseAdminClient();
  const contextResult = await adminClient
    .from("usuarios_papeis_contexto")
    .select("id, usuario_id, ativo")
    .eq("id", parsed.data.contexto_id)
    .maybeSingle();
  const contextRow = contextResult.data as ContextSwitchRow | null;
  const contextError = contextResult.error;

  if (contextError || !contextRow) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message: "Não foi possível localizar o contexto selecionado.",
      selectedContextId: parsed.data.contexto_id
    });
  }

  if (contextRow.usuario_id !== currentUser.id) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message: "Você não pode selecionar um contexto que pertence a outro usuário.",
      selectedContextId: parsed.data.contexto_id
    });
  }

  if (!contextRow.ativo) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message: "O contexto selecionado está inativo.",
      selectedContextId: parsed.data.contexto_id
    });
  }

  const updatePayload = {
    contexto_padrao_id: contextRow.id
  } satisfies UserContextDefaultUpdate;

  const { error: updateError } = await adminClient
    .from("usuarios")
    .update(updatePayload as never)
    .eq("id", currentUser.id);

  if (updateError) {
    return buildContextSwitchState(initialContextSwitchActionState, {
      status: "error",
      message: "Não foi possível definir o contexto padrão selecionado.",
      selectedContextId: parsed.data.contexto_id
    });
  }

  revalidatePath("/", "layout");

  return buildContextSwitchState(initialContextSwitchActionState, {
    status: "success",
    message: "Contexto atualizado com sucesso.",
    selectedContextId: contextRow.id
  });
}
