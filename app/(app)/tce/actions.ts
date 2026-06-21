"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import type {
  StudentTceActionState,
  StudentTceDocumentActionState,
  StudentTceFormValues
} from "@/app/(app)/tce/state";
import {
  generateStudentTceDocument,
  saveStudentTceData,
  TceServiceError
} from "@/services/tce";

const emailSchema = z.string().email();

const optionalTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `O campo deve ter no máximo ${maxLength} caracteres.`);

const studentTceFormSchema = z.object({
  configuration_id: z.string().uuid("TCE inválido."),
  enrollment_id: z.string().uuid("Matrícula inválida."),
  area_estagio_id: z.string().uuid("Área de estágio inválida."),
  full_name: optionalTextSchema(160),
  registration: optionalTextSchema(60),
  campus: optionalTextSchema(160),
  course_name: optionalTextSchema(160),
  semester_label: optionalTextSchema(120),
  shift: optionalTextSchema(80),
  address: optionalTextSchema(160),
  address_number: optionalTextSchema(30),
  address_complement: optionalTextSchema(80),
  neighborhood: optionalTextSchema(120),
  city: optionalTextSchema(120),
  state: z.string().trim().max(2, "A UF deve ter no máximo 2 caracteres."),
  postal_code: optionalTextSchema(20),
  phone: optionalTextSchema(30),
  email: z
    .string()
    .trim()
    .max(160, "O e-mail deve ter no máximo 160 caracteres.")
    .refine((value) => !value || emailSchema.safeParse(value).success, {
      message: "Informe um e-mail válido."
    })
});

function readField(formData: FormData, fieldName: string) {
  return String(formData.get(fieldName) ?? "");
}

function extractFormValues(formData: FormData): StudentTceFormValues {
  return {
    configuration_id: readField(formData, "configuration_id"),
    enrollment_id: readField(formData, "enrollment_id"),
    area_estagio_id: readField(formData, "area_estagio_id"),
    full_name: readField(formData, "full_name"),
    registration: readField(formData, "registration"),
    campus: readField(formData, "campus"),
    course_name: readField(formData, "course_name"),
    semester_label: readField(formData, "semester_label"),
    shift: readField(formData, "shift"),
    address: readField(formData, "address"),
    address_number: readField(formData, "address_number"),
    address_complement: readField(formData, "address_complement"),
    neighborhood: readField(formData, "neighborhood"),
    city: readField(formData, "city"),
    state: readField(formData, "state"),
    postal_code: readField(formData, "postal_code"),
    phone: readField(formData, "phone"),
    email: readField(formData, "email")
  };
}

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: StudentTceFormValues
): StudentTceActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    savedAt: null,
    submittedAt: Date.now()
  };
}

function buildSuccessState(
  message: string,
  savedAt: string | null,
  formValues: StudentTceFormValues
): StudentTceActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    formValues,
    savedAt,
    submittedAt: Date.now()
  };
}

function buildDocumentErrorState(
  message: string,
  fieldErrors: Record<string, string> = {}
): StudentTceDocumentActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    generatedAt: null,
    submittedAt: Date.now()
  };
}

function buildDocumentSuccessState(
  message: string,
  generatedAt: string | null
): StudentTceDocumentActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    generatedAt,
    submittedAt: Date.now()
  };
}

function normalizeDocumentGenerationFieldErrors(
  fieldErrors: Record<string, string>
): Record<string, string> {
  const labels: Record<string, string> = {
    full_name: "Nome",
    registration: "RA",
    course_name: "Curso",
    address: "Endereço",
    city: "Município",
    state: "UF",
    postal_code: "CEP",
    phone: "Telefone",
    email: "E-mail"
  };

  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, message]) => [
      field,
      labels[field] ? `${labels[field]} é obrigatório para gerar o TCE.` : message
    ])
  );
}

function getDocumentGenerationErrorMessage(error: TceServiceError) {
  if (error.kind === "validation") {
    return Object.keys(error.fieldErrors).length
      ? "Preencha e salve os dados obrigatórios antes de gerar o TCE."
      : "Salve os dados do TCE antes de gerar o documento.";
  }

  return error.message;
}

export async function saveStudentTceDataAction(
  _previousState: StudentTceActionState,
  formData: FormData
): Promise<StudentTceActionState> {
  const currentUser = await requireRole(["aluno"]);
  const formValues = extractFormValues(formData);
  const parsedData = studentTceFormSchema.safeParse(formValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos do TCE antes de salvar.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      formValues
    );
  }

  try {
    const savedTce = await saveStudentTceData(currentUser, {
      configurationId: parsedData.data.configuration_id,
      enrollmentId: parsedData.data.enrollment_id,
      areaId: parsedData.data.area_estagio_id,
      studentData: {
        fullName: parsedData.data.full_name || null,
        registration: parsedData.data.registration || null,
        campus: parsedData.data.campus || null,
        courseName: parsedData.data.course_name || null,
        semesterLabel: parsedData.data.semester_label || null,
        shift: parsedData.data.shift || null,
        address: parsedData.data.address || null,
        addressNumber: parsedData.data.address_number || null,
        addressComplement: parsedData.data.address_complement || null,
        neighborhood: parsedData.data.neighborhood || null,
        city: parsedData.data.city || null,
        state: parsedData.data.state || null,
        postalCode: parsedData.data.postal_code || null,
        phone: parsedData.data.phone || null,
        email: parsedData.data.email || null
      }
    });

    revalidatePath("/tce");

    return buildSuccessState(
      "Dados do TCE salvos com sucesso.",
      savedTce.updatedAt,
      formValues
    );
  } catch (error) {
    if (error instanceof TceServiceError) {
      return buildErrorState(error.message, error.fieldErrors, formValues);
    }

    return buildErrorState(
      "Não foi possível salvar os dados do TCE neste momento.",
      {},
      formValues
    );
  }
}

export async function generateStudentTceDocumentAction(
  _previousState: StudentTceDocumentActionState,
  formData: FormData
): Promise<StudentTceDocumentActionState> {
  const currentUser = await requireRole(["aluno"]);
  const configurationId = readField(formData, "configuration_id");

  if (!configurationId) {
    return buildDocumentErrorState("O TCE selecionado é inválido.");
  }

  try {
    const generated = await generateStudentTceDocument(currentUser, configurationId);

    revalidatePath("/tce");

    return buildDocumentSuccessState(
      "TCE gerado com sucesso. Você já pode baixar o documento em Word.",
      generated.tce.generatedAt
    );
  } catch (error) {
    if (error instanceof TceServiceError) {
      return buildDocumentErrorState(
        getDocumentGenerationErrorMessage(error),
        normalizeDocumentGenerationFieldErrors(error.fieldErrors)
      );
    }

    return buildDocumentErrorState(
      "Não foi possível gerar o TCE neste momento."
    );
  }
}
