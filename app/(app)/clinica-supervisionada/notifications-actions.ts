"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClinicalRecordType } from "@/types/domain";

const markClinicalNotificationAsReadSchema = z.object({
  notification_id: z.string().uuid("Notificação clínica inválida."),
  case_id: z.string().uuid("Caso clínico inválido.")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const markClinicalApprovalNotificationsAsReadSchema = z.object({
  case_id: z.string().uuid("Caso clínico inválido."),
  record_id: z.string().uuid("Registro clínico inválido."),
  record_type: z.enum(["avaliacao", "plano_tratamento", "evolucao"])
});

function getApprovalNotificationType(recordType: ClinicalRecordType) {
  switch (recordType) {
    case "plano_tratamento":
      return "plano_tratamento_aprovado";
    case "evolucao":
      return "evolucao_aprovada";
    default:
      return "avaliacao_aprovada";
  }
}

export async function markClinicalNotificationAsReadAction(
  formData: FormData
): Promise<void> {
  const currentUser = await requireRole(["professor", "aluno"]);
  const parsedData = markClinicalNotificationAsReadSchema.safeParse({
    notification_id: readStringField(formData, "notification_id"),
    case_id: readStringField(formData, "case_id")
  });

  if (!parsedData.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: notificationRowData, error: notificationError } = await supabase
    .from("notificacoes_clinicas")
    .select("id, lida")
    .eq("id", parsedData.data.notification_id)
    .eq("usuario_id", currentUser.id)
    .eq("caso_clinico_id", parsedData.data.case_id)
    .maybeSingle();
  const notificationRow = (notificationRowData ?? null) as {
    id: string;
    lida: boolean;
  } | null;

  if (notificationError || !notificationRow || notificationRow.lida) {
    return;
  }

  await (supabase.from("notificacoes_clinicas") as any)
    .update({
      lida: true,
      lida_em: new Date().toISOString()
    })
    .eq("id", parsedData.data.notification_id)
    .eq("usuario_id", currentUser.id)
    .eq("caso_clinico_id", parsedData.data.case_id);

  revalidatePath("/clinica-supervisionada");
  revalidatePath("/clinica-supervisionada/historico");
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}`);
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}/avaliacao`);
  revalidatePath(
    `/clinica-supervisionada/${parsedData.data.case_id}/plano-tratamento`
  );
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}/evolucao`);
  revalidatePath("/aluno");
  revalidatePath("/professor");
}

export async function markClinicalApprovalNotificationsAsReadForRecordAction(input: {
  case_id: string;
  record_id: string;
  record_type: ClinicalRecordType;
}): Promise<boolean> {
  const currentUser = await requireRole(["aluno"]);
  const parsedData = markClinicalApprovalNotificationsAsReadSchema.safeParse(input);

  if (!parsedData.success) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const approvalType = getApprovalNotificationType(parsedData.data.record_type);
  const { data: notificationRowsData, error: notificationError } = await supabase
    .from("notificacoes_clinicas")
    .select("id")
    .eq("usuario_id", currentUser.id)
    .eq("caso_clinico_id", parsedData.data.case_id)
    .eq("registro_clinico_id", parsedData.data.record_id)
    .eq("tipo", approvalType)
    .eq("lida", false);

  if (notificationError || !notificationRowsData?.length) {
    return false;
  }

  const notificationIds = (
    notificationRowsData as Array<{
      id: string;
    }>
  ).map((row) => row.id);

  await (supabase.from("notificacoes_clinicas") as any)
    .update({
      lida: true,
      lida_em: new Date().toISOString()
    })
    .in("id", notificationIds)
    .eq("usuario_id", currentUser.id)
    .eq("caso_clinico_id", parsedData.data.case_id)
    .eq("registro_clinico_id", parsedData.data.record_id)
    .eq("tipo", approvalType);

  revalidatePath("/clinica-supervisionada");
  revalidatePath("/clinica-supervisionada/historico");
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}`);
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}/avaliacao`);
  revalidatePath(
    `/clinica-supervisionada/${parsedData.data.case_id}/plano-tratamento`
  );
  revalidatePath(`/clinica-supervisionada/${parsedData.data.case_id}/evolucao`);
  revalidatePath(
    `/clinica-supervisionada/${parsedData.data.case_id}/evolucao/${parsedData.data.record_id}`
  );
  revalidatePath("/aluno");
  revalidatePath("/professor");

  return true;
}
