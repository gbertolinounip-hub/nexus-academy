"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatStudentDocumentType } from "@/lib/utils/format";
import {
  buildStudentDocumentStoragePath,
  ensureStudentDocumentsBucket,
  getStudentDocumentScopeForCurrentStudent,
  STUDENT_DOCUMENT_ACCEPTED_EXTENSIONS,
  STUDENT_DOCUMENT_ACCEPTED_MIME_TYPES,
  STUDENT_DOCUMENT_MAX_BYTES,
  STUDENT_DOCUMENTS_BUCKET
} from "@/services/student-documents";
import type { Database } from "@/types/database";
import type {
  StudentDocumentNotificationType,
  StudentDocumentReviewerRole,
  StudentDocumentStatus,
  StudentDocumentType
} from "@/types/domain";
import type {
  StudentDocumentReviewActionState,
  StudentDocumentUploadActionState
} from "@/app/(app)/documentos/state";

type DocumentInsert = Database["public"]["Tables"]["documentos_aluno"]["Insert"];

const studentDocumentUploadSchema = z.object({
  document_type: z.enum(["carteira_vacinacao", "tce"]),
  enrollment_id: z.string().trim().optional().default("")
});

const studentDocumentReviewSchema = z
  .object({
    document_id: z.string().uuid("Documento inválido."),
    decision: z.enum(["aprovado", "reprovado"]),
    rejection_reason: z.string().trim().max(3000)
  })
  .superRefine((value, context) => {
    if (value.decision === "reprovado" && !value.rejection_reason.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "A justificativa é obrigatória quando o documento é reprovado."
      });
    }
  });

const markStudentDocumentNotificationAsReadSchema = z.object({
  notification_id: z.string().uuid("Notificação inválida.")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

function resolveAcceptedMimeType(file: File, extension: string) {
  const mime = file.type.trim().toLowerCase();

  if (mime && STUDENT_DOCUMENT_ACCEPTED_MIME_TYPES.includes(mime as never)) {
    return mime;
  }

  if (extension === "pdf") {
    return "application/pdf";
  }

  if (["jpg", "jpeg"].includes(extension)) {
    return "image/jpeg";
  }

  if (extension === "png") {
    return "image/png";
  }

  return "";
}

function buildUploadState(input: {
  status: StudentDocumentUploadActionState["status"];
  message: string | null;
  documentType: StudentDocumentType;
  enrollmentId?: string;
  fieldErrors?: Record<string, string>;
  savedDocumentId?: string | null;
}): StudentDocumentUploadActionState {
  return {
    status: input.status,
    message: input.message,
    fieldErrors: input.fieldErrors ?? {},
    formValues: {
      document_type: input.documentType,
      enrollment_id: input.enrollmentId ?? ""
    },
    savedDocumentId: input.savedDocumentId ?? null,
    submittedAt: Date.now()
  };
}

function buildReviewState(input: {
  status: StudentDocumentReviewActionState["status"];
  message: string | null;
  documentId: string;
  decision: StudentDocumentStatus;
  rejectionReason: string;
  fieldErrors?: Record<string, string>;
}): StudentDocumentReviewActionState {
  return {
    status: input.status,
    message: input.message,
    fieldErrors: input.fieldErrors ?? {},
    formValues: {
      document_id: input.documentId,
      decision: input.decision,
      rejection_reason: input.rejectionReason
    },
    submittedAt: Date.now()
  };
}

function buildDocumentNotificationContent(input: {
  reviewerRole: StudentDocumentReviewerRole;
  documentType: StudentDocumentType;
  areaName: string | null;
}) {
  const documentLabel = formatStudentDocumentType(input.documentType);
  const areaLabel = input.areaName ? ` · ${input.areaName}` : "";

  if (input.reviewerRole === "coordenador") {
    return {
      type: "documento_reprovado_coordenador" as StudentDocumentNotificationType,
      title: "Documento reprovado pela coordenação",
      message: `A coordenação reprovou seu ${documentLabel.toLowerCase()}${areaLabel}. Verifique a justificativa e envie uma nova versão.`
    };
  }

  return {
    type: "documento_reprovado_professor" as StudentDocumentNotificationType,
    title: "Documento reprovado pelo professor",
    message: `O professor supervisor reprovou seu ${documentLabel.toLowerCase()}${areaLabel}. Verifique a justificativa e envie uma nova versão.`
  };
}

function revalidateStudentDocumentPaths(studentId: string) {
  revalidatePath("/documentos");
  revalidatePath("/aluno");
  revalidatePath("/professor/documentos");
  revalidatePath(`/professor/documentos/${studentId}`);
  revalidatePath("/coordenador/documentos");
  revalidatePath(`/coordenador/documentos/${studentId}`);
  revalidatePath("/master/documentos");
  revalidatePath(`/master/documentos/${studentId}`);
}

export async function submitStudentDocumentAction(
  _previousState: StudentDocumentUploadActionState,
  formData: FormData
): Promise<StudentDocumentUploadActionState> {
  const currentUser = await requireRole(["aluno"]);
  const parsedData = studentDocumentUploadSchema.safeParse({
    document_type: readStringField(formData, "document_type"),
    enrollment_id: readStringField(formData, "enrollment_id")
  });

  if (!parsedData.success) {
    const fallbackType = readStringField(formData, "document_type") === "tce" ? "tce" : "carteira_vacinacao";
    return buildUploadState({
      status: "error",
      message: "Revise o tipo de documento antes de continuar.",
      documentType: fallbackType,
      enrollmentId: readStringField(formData, "enrollment_id"),
      fieldErrors: {
        document_type: "Tipo de documento inválido."
      }
    });
  }

  const uploadedFile = formData.get("document_file");

  if (!(uploadedFile instanceof File) || uploadedFile.size <= 0) {
    return buildUploadState({
      status: "error",
      message: "Selecione um arquivo antes de enviar o documento.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id,
      fieldErrors: {
        document_file: "Envie um arquivo .pdf, .jpg, .jpeg ou .png."
      }
    });
  }

  if (uploadedFile.size > STUDENT_DOCUMENT_MAX_BYTES) {
    return buildUploadState({
      status: "error",
      message: "O arquivo excede o tamanho máximo suportado nesta etapa.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id,
      fieldErrors: {
        document_file: "Use um arquivo com até 10 MB."
      }
    });
  }

  const fileExtension = getFileExtension(uploadedFile.name);

  if (!STUDENT_DOCUMENT_ACCEPTED_EXTENSIONS.includes(fileExtension as never)) {
    return buildUploadState({
      status: "error",
      message: "Formato de arquivo não suportado para este envio.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id,
      fieldErrors: {
        document_file: "Use apenas .pdf, .jpg, .jpeg ou .png."
      }
    });
  }

  const resolvedMimeType = resolveAcceptedMimeType(uploadedFile, fileExtension);

  if (!resolvedMimeType) {
    return buildUploadState({
      status: "error",
      message: "O arquivo enviado não pôde ser validado com segurança.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id,
      fieldErrors: {
        document_file: "O tipo MIME do arquivo não é aceito nesta etapa."
      }
    });
  }

  if (!currentUser.unitId) {
    return buildUploadState({
      status: "error",
      message: "Seu usuário não está vinculado a uma unidade operacional.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id
    });
  }

  try {
    const pageData = await getStudentDocumentScopeForCurrentStudent(currentUser);
    const documentType = parsedData.data.document_type;
    const selectedEnrollment =
      documentType === "tce"
        ? pageData.tceOptions.find(
            (option) => option.enrollmentId === parsedData.data.enrollment_id
          ) ?? null
        : null;

    if (documentType === "tce" && !selectedEnrollment) {
      return buildUploadState({
        status: "error",
        message: "Selecione a área e o bloco corretos antes de enviar o TCE.",
        documentType,
        enrollmentId: parsedData.data.enrollment_id,
        fieldErrors: {
          enrollment_id: "Escolha uma área/bloco válido para este TCE."
        }
      });
    }

    const previousDocument =
      documentType === "carteira_vacinacao"
        ? pageData.vaccinationCurrent
        : pageData.tceDocuments.find(
            (document) =>
              document.active &&
              document.enrollmentId === selectedEnrollment?.enrollmentId
          ) ?? null;

    await ensureStudentDocumentsBucket();

    const documentId = randomUUID();
    const storagePath = buildStudentDocumentStoragePath({
      unitId: currentUser.unitId,
      studentId: currentUser.id,
      documentId,
      documentType,
      fileName: uploadedFile.name || `documento.${fileExtension}`,
      enrollmentId: selectedEnrollment?.enrollmentId ?? null,
      areaName: selectedEnrollment?.areaName ?? null,
      blockName: selectedEnrollment?.blockName ?? null
    });
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const adminClient = createSupabaseAdminClient();

    const { error: uploadError } = await adminClient.storage
      .from(STUDENT_DOCUMENTS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: resolvedMimeType,
        upsert: false
      });

    if (uploadError) {
      return buildUploadState({
        status: "error",
        message:
          "Não foi possível enviar o arquivo para o storage privado do aluno.",
        documentType,
        enrollmentId: selectedEnrollment?.enrollmentId ?? "",
        fieldErrors: {
          document_file: "O upload falhou. Tente novamente em instantes."
        }
      });
    }

    if (previousDocument) {
      const { error: deactivatePreviousError } = await (adminClient.from(
        "documentos_aluno"
      ) as any)
        .update({ ativo: false })
        .eq("id", previousDocument.id);

      if (deactivatePreviousError) {
        await adminClient.storage.from(STUDENT_DOCUMENTS_BUCKET).remove([storagePath]);

        return buildUploadState({
          status: "error",
          message: "Não foi possível preparar o reenvio deste documento.",
          documentType,
          enrollmentId: selectedEnrollment?.enrollmentId ?? ""
        });
      }
    }

    const supabase = await createSupabaseServerClient();
    const documentInsertPayload: DocumentInsert = {
      id: documentId,
      unidade_id: currentUser.unitId,
      aluno_id: currentUser.id,
      matricula_turma_id: selectedEnrollment?.enrollmentId ?? null,
      area_estagio_id: selectedEnrollment?.areaId ?? null,
      tipo: documentType,
      status: "enviado",
      arquivo_nome: uploadedFile.name,
      arquivo_mime_type: resolvedMimeType,
      arquivo_tamanho_bytes: uploadedFile.size,
      storage_path: storagePath,
      observacao_validacao: null,
      ativo: true,
      versao: previousDocument ? previousDocument.version + 1 : 1,
      documento_anterior_id: previousDocument?.id ?? null,
      validado_por: null,
      validado_por_papel: null,
      enviado_em: new Date().toISOString(),
      validado_em: null
    };

    const { error: insertError } = await (supabase.from("documentos_aluno") as any).insert(
      documentInsertPayload
    );

    if (insertError) {
      await adminClient.storage.from(STUDENT_DOCUMENTS_BUCKET).remove([storagePath]);

      if (previousDocument) {
        await (adminClient.from("documentos_aluno") as any)
          .update({ ativo: true })
          .eq("id", previousDocument.id);
      }

      return buildUploadState({
        status: "error",
        message: "Não foi possível registrar o documento enviado no banco.",
        documentType,
        enrollmentId: selectedEnrollment?.enrollmentId ?? "",
        fieldErrors: {
          document_file: "O arquivo foi recebido, mas o cadastro do documento falhou."
        }
      });
    }

    revalidateStudentDocumentPaths(currentUser.id);

    return buildUploadState({
      status: "success",
      message:
        documentType === "carteira_vacinacao"
          ? "Carteira de vacinação enviada com sucesso."
          : "TCE enviado com sucesso.",
      documentType,
      enrollmentId: selectedEnrollment?.enrollmentId ?? "",
      savedDocumentId: documentId
    });
  } catch (error) {
    return buildUploadState({
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o documento do aluno.",
      documentType: parsedData.data.document_type,
      enrollmentId: parsedData.data.enrollment_id
    });
  }
}

export async function reviewStudentDocumentAction(
  _previousState: StudentDocumentReviewActionState,
  formData: FormData
): Promise<StudentDocumentReviewActionState> {
  const currentUser = await requireRole(["professor", "coordenador"]);
  const parsedData = studentDocumentReviewSchema.safeParse({
    document_id: readStringField(formData, "document_id"),
    decision: readStringField(formData, "decision"),
    rejection_reason: readStringField(formData, "rejection_reason")
  });

  if (!parsedData.success) {
    const fieldErrors = parsedData.error.flatten().fieldErrors;
    return buildReviewState({
      status: "error",
      message: "Revise a decisão e a justificativa antes de salvar a validação.",
      documentId: readStringField(formData, "document_id"),
      decision:
        readStringField(formData, "decision") === "reprovado"
          ? "reprovado"
          : "aprovado",
      rejectionReason: readStringField(formData, "rejection_reason"),
      fieldErrors: {
        document_id: fieldErrors.document_id?.[0] ?? "",
        decision: fieldErrors.decision?.[0] ?? "",
        rejection_reason: fieldErrors.rejection_reason?.[0] ?? ""
      }
    });
  }

  const reviewerRole: StudentDocumentReviewerRole =
    currentUser.role === "coordenador" ? "coordenador" : "professor";
  const rejectionReason =
    parsedData.data.decision === "reprovado"
      ? parsedData.data.rejection_reason.trim()
      : "";

  try {
    const supabase = await createSupabaseServerClient();
    const { data: documentRowData, error: documentRowError } = await supabase
      .from("documentos_aluno")
      .select("*")
      .eq("id", parsedData.data.document_id)
      .maybeSingle();
    const documentRow = (documentRowData ?? null) as
      | Database["public"]["Tables"]["documentos_aluno"]["Row"]
      | null;

    if (documentRowError || !documentRow) {
      return buildReviewState({
        status: "error",
        message: "O documento solicitado não está disponível para esta validação.",
        documentId: parsedData.data.document_id,
        decision: parsedData.data.decision,
        rejectionReason
      });
    }

    const reviewedAt = new Date().toISOString();
    const { error: updateError } = await (supabase.from("documentos_aluno") as any)
      .update({
        status: parsedData.data.decision,
        observacao_validacao: rejectionReason || null,
        validado_por: currentUser.id,
        validado_por_papel: reviewerRole,
        validado_em: reviewedAt
      })
      .eq("id", parsedData.data.document_id);

    if (updateError) {
      return buildReviewState({
        status: "error",
        message: "Não foi possível salvar a validação deste documento.",
        documentId: parsedData.data.document_id,
        decision: parsedData.data.decision,
        rejectionReason
      });
    }

    if (parsedData.data.decision === "reprovado") {
      let areaName: string | null = null;

      if (documentRow.area_estagio_id) {
        const { data: areaRowData } = await supabase
          .from("areas_estagio")
          .select("nome")
          .eq("id", documentRow.area_estagio_id)
          .maybeSingle();

        areaName =
          areaRowData && typeof areaRowData === "object" && "nome" in areaRowData
            ? ((areaRowData as { nome?: string | null }).nome ?? null)
            : null;
      }

      const notificationContent = buildDocumentNotificationContent({
        reviewerRole,
        documentType: documentRow.tipo as StudentDocumentType,
        areaName
      });

      const { error: notificationError } = await (supabase.from(
        "notificacoes_documentos_aluno"
      ) as any).insert({
        unidade_id: documentRow.unidade_id,
        usuario_id: documentRow.aluno_id,
        documento_id: documentRow.id,
        tipo: notificationContent.type,
        titulo: notificationContent.title,
        mensagem: notificationContent.message
      });

      if (notificationError) {
        return buildReviewState({
          status: "error",
          message:
            "A validação foi salva, mas a notificação ao aluno não pôde ser registrada.",
          documentId: parsedData.data.document_id,
          decision: parsedData.data.decision,
          rejectionReason
        });
      }
    }

    revalidateStudentDocumentPaths(documentRow.aluno_id);

    return buildReviewState({
      status: "success",
      message:
        parsedData.data.decision === "aprovado"
          ? "Documento aprovado com sucesso."
          : "Documento reprovado e notificação enviada ao aluno.",
      documentId: parsedData.data.document_id,
      decision: parsedData.data.decision,
      rejectionReason
    });
  } catch (error) {
    return buildReviewState({
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a validação do documento.",
      documentId: parsedData.data.document_id,
      decision: parsedData.data.decision,
      rejectionReason
    });
  }
}

export async function markStudentDocumentNotificationAsReadAction(
  formData: FormData
): Promise<void> {
  const currentUser = await requireRole(["aluno"]);
  const parsedData = markStudentDocumentNotificationAsReadSchema.safeParse({
    notification_id: readStringField(formData, "notification_id")
  });

  if (!parsedData.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: notificationRowData, error: notificationError } = await supabase
    .from("notificacoes_documentos_aluno")
    .select("id, lida")
    .eq("id", parsedData.data.notification_id)
    .eq("usuario_id", currentUser.id)
    .maybeSingle();
  const notificationRow = (notificationRowData ?? null) as
    | { id: string; lida: boolean }
    | null;

  if (notificationError || !notificationRow || notificationRow.lida) {
    return;
  }

  await (supabase.from("notificacoes_documentos_aluno") as any)
    .update({
      lida: true,
      lida_em: new Date().toISOString()
    })
    .eq("id", parsedData.data.notification_id)
    .eq("usuario_id", currentUser.id);

  revalidatePath("/documentos");
  revalidatePath("/aluno");
}
