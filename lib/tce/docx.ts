import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type {
  TceConfigurationSnapshot,
  TceScheduleData,
  TceStudentData
} from "@/types/domain";

interface TceDocxRenderInput {
  snapshot: TceConfigurationSnapshot;
  studentData: TceStudentData;
}

type TceTemplateData = Record<string, string>;

export const UNIP_TCE_DOCX_TEMPLATE_VERSION = "v1";
export const UNIP_TCE_DOCX_TEMPLATE_PATH =
  "assets/templates/tce/tce-obrigatorio-unip-v1.docx";

const TEMPLATE_SUPPORTED_VERSIONS = new Set([
  UNIP_TCE_DOCX_TEMPLATE_VERSION,
  null,
  ""
]);

interface ParsedDateParts {
  day: string;
  month: string;
  year: string;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getOptionalText(value: string | null | undefined) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function normalizeMultilineText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDateParts(value: string | null | undefined): ParsedDateParts | null {
  const normalizedValue = getOptionalText(value);

  if (!normalizedValue) {
    return null;
  }

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return {
      day: isoMatch[3],
      month: isoMatch[2],
      year: isoMatch[1]
    };
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    day: String(parsedDate.getUTCDate()).padStart(2, "0"),
    month: String(parsedDate.getUTCMonth() + 1).padStart(2, "0"),
    year: String(parsedDate.getUTCFullYear())
  };
}

function formatLongDate(value: string | null | undefined) {
  const parts = parseDateParts(value);

  if (!parts) {
    return getOptionalText(value);
  }

  const asDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(asDate);
}

function formatWorkloadHours(value: string | null | undefined) {
  const normalizedValue = getOptionalText(value);

  if (!normalizedValue) {
    return "";
  }

  if (/h\b/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^\d+([.,]\d+)?$/.test(normalizedValue)) {
    return `${normalizedValue}h`;
  }

  return normalizedValue;
}

function getScheduleValue(
  scheduleData: TceScheduleData,
  day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday",
  field: "startTime" | "endTime" | "breakStartTime" | "breakEndTime"
) {
  return getOptionalText(scheduleData[day]?.[field] ?? "");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toWordTextFragment(value: string) {
  if (!value) {
    return "";
  }

  return escapeXml(value).replace(/\n/g, "</w:t><w:br/><w:t xml:space=\"preserve\">");
}

function normalizeTemplateXmlPlaceholders(
  xml: string,
  placeholderKeys: readonly string[]
) {
  let normalized = xml.replace(/<w:proofErr[^>]*\/>/g, "");

  for (const key of placeholderKeys) {
    const splitPlaceholderPattern = new RegExp(
      `<w:t[^>]*>([^<]*?)\\{\\{<\\/w:t>[\\s\\S]*?<w:t[^>]*>${escapeRegExp(
        key
      )}<\\/w:t>[\\s\\S]*?<w:t[^>]*>\\}\\}([^<]*?)<\\/w:t>`,
      "g"
    );

    normalized = normalized.replace(
      splitPlaceholderPattern,
      (_match, prefix: string, suffix: string) =>
        `<w:t xml:space="preserve">${prefix}{{${key}}}${suffix}</w:t>`
    );
  }

  return normalized;
}

function applyTemplateValues(xml: string, templateData: TceTemplateData) {
  let populated = xml;

  for (const [key, value] of Object.entries(templateData)) {
    populated = populated.split(`{{${key}}}`).join(toWordTextFragment(value));
  }

  return populated;
}

function buildStudentTceTemplateData(input: TceDocxRenderInput): TceTemplateData {
  const { snapshot, studentData } = input;
  const concedingPartyData = snapshot.fixedData.concedingPartyData;
  const termData = snapshot.fixedData.termData;
  const scheduleData = snapshot.fixedData.scheduleData;
  const startsAt = parseDateParts(termData.startsAt);
  const endsAt = parseDateParts(termData.endsAt);
  const weeklyOrSemesterWorkload =
    snapshot.fixedData.weeklyWorkload ?? snapshot.fixedData.semesterWorkload;

  return {
    concedente_razao_social: getOptionalText(concedingPartyData.corporateName),
    concedente_cnpj: getOptionalText(concedingPartyData.documentNumber),
    concedente_endereco: getOptionalText(concedingPartyData.address),
    concedente_numero: getOptionalText(concedingPartyData.addressNumber),
    concedente_complemento: getOptionalText(concedingPartyData.addressComplement),
    concedente_bairro: getOptionalText(concedingPartyData.neighborhood),
    concedente_municipio: getOptionalText(concedingPartyData.city),
    concedente_uf: getOptionalText(concedingPartyData.state),
    concedente_cep: getOptionalText(concedingPartyData.postalCode),
    concedente_telefone: getOptionalText(concedingPartyData.phone),
    concedente_email: getOptionalText(concedingPartyData.email),
    concedente_local_estagio: getOptionalText(
      concedingPartyData.internshipLocation
    ),
    concedente_local_endereco: getOptionalText(
      concedingPartyData.internshipLocationAddress
    ),
    concedente_local_numero: getOptionalText(
      concedingPartyData.internshipLocationNumber
    ),
    concedente_local_complemento: getOptionalText(
      concedingPartyData.internshipLocationComplement
    ),
    concedente_local_bairro: getOptionalText(
      concedingPartyData.internshipLocationNeighborhood
    ),
    concedente_local_municipio: getOptionalText(
      concedingPartyData.internshipLocationCity
    ),
    concedente_local_uf: getOptionalText(
      concedingPartyData.internshipLocationState
    ),
    concedente_local_cep: getOptionalText(
      concedingPartyData.internshipLocationPostalCode
    ),
    concedente_local_telefone: getOptionalText(
      concedingPartyData.internshipLocationPhone
    ),
    concedente_local_email: getOptionalText(
      concedingPartyData.internshipLocationEmail
    ),
    concedente_responsavel: getOptionalText(concedingPartyData.responsibleName),
    concedente_rg_funcional: getOptionalText(
      concedingPartyData.responsibleDocument
    ),
    concedente_conselho: getOptionalText(
      concedingPartyData.professionalCouncil
    ),

    estagiario_nome: getOptionalText(studentData.fullName),
    estagiario_ra: getOptionalText(studentData.registration),
    estagiario_campus_polo: getOptionalText(studentData.campus),
    estagiario_curso:
      getOptionalText(studentData.courseName) ||
      getOptionalText(snapshot.context.courseName),
    estagiario_semestre:
      getOptionalText(studentData.semesterLabel) ||
      getOptionalText(snapshot.context.semesterCode),
    estagiario_turno: getOptionalText(studentData.shift),
    estagiario_endereco: getOptionalText(studentData.address),
    estagiario_numero: getOptionalText(studentData.addressNumber),
    estagiario_complemento: getOptionalText(studentData.addressComplement),
    estagiario_bairro: getOptionalText(studentData.neighborhood),
    estagiario_municipio: getOptionalText(studentData.city),
    estagiario_uf: getOptionalText(studentData.state),
    estagiario_cep: getOptionalText(studentData.postalCode),
    estagiario_email: getOptionalText(studentData.email),
    estagiario_telefone: getOptionalText(studentData.phone),
    "estagiário_telefone": getOptionalText(studentData.phone),

    vigencia_inicio_dia: startsAt?.day ?? "",
    vigencia_inicio_mes: startsAt?.month ?? "",
    vigencia_inicio_ano: startsAt?.year ?? "",
    vigencia_fim_dia: endsAt?.day ?? "",
    vigencia_fim_mes: endsAt?.month ?? "",
    vigencia_fim_ano: endsAt?.year ?? "",

    segunda_inicio: getScheduleValue(scheduleData, "monday", "startTime"),
    segunda_fim: getScheduleValue(scheduleData, "monday", "endTime"),
    segunda_intervalo_inicio: getScheduleValue(
      scheduleData,
      "monday",
      "breakStartTime"
    ),
    segunda_intervalo_fim: getScheduleValue(
      scheduleData,
      "monday",
      "breakEndTime"
    ),
    terca_inicio: getScheduleValue(scheduleData, "tuesday", "startTime"),
    terca_fim: getScheduleValue(scheduleData, "tuesday", "endTime"),
    terca_intervalo_inicio: getScheduleValue(
      scheduleData,
      "tuesday",
      "breakStartTime"
    ),
    terca_intervalo_fim: getScheduleValue(
      scheduleData,
      "tuesday",
      "breakEndTime"
    ),
    quarta_inicio: getScheduleValue(scheduleData, "wednesday", "startTime"),
    quarta_fim: getScheduleValue(scheduleData, "wednesday", "endTime"),
    quarta_intervalo_inicio: getScheduleValue(
      scheduleData,
      "wednesday",
      "breakStartTime"
    ),
    quarta_intervalo_fim: getScheduleValue(
      scheduleData,
      "wednesday",
      "breakEndTime"
    ),
    quinta_inicio: getScheduleValue(scheduleData, "thursday", "startTime"),
    quinta_fim: getScheduleValue(scheduleData, "thursday", "endTime"),
    quinta_intervalo_inicio: getScheduleValue(
      scheduleData,
      "thursday",
      "breakStartTime"
    ),
    quinta_intervalo_fim: getScheduleValue(
      scheduleData,
      "thursday",
      "breakEndTime"
    ),
    sexta_inicio: getScheduleValue(scheduleData, "friday", "startTime"),
    setxa_inicio: getScheduleValue(scheduleData, "friday", "startTime"),
    sexta_fim: getScheduleValue(scheduleData, "friday", "endTime"),
    sexta_intervalo_inicio: getScheduleValue(
      scheduleData,
      "friday",
      "breakStartTime"
    ),
    sexta_intervalo_fim: getScheduleValue(
      scheduleData,
      "friday",
      "breakEndTime"
    ),
    sabado_inicio: getScheduleValue(scheduleData, "saturday", "startTime"),
    sabado_fim: getScheduleValue(scheduleData, "saturday", "endTime"),
    sabado_intervalo_inicio: getScheduleValue(
      scheduleData,
      "saturday",
      "breakStartTime"
    ),
    sabado_intervalo_fim: getScheduleValue(
      scheduleData,
      "saturday",
      "breakEndTime"
    ),

    jornada_diaria: formatWorkloadHours(snapshot.fixedData.dailyWorkload),
    jornada_semanal: formatWorkloadHours(weeklyOrSemesterWorkload),

    plano_atividades: normalizeMultilineText(snapshot.fixedData.activityPlan),

    cidade_assinatura: getOptionalText(snapshot.fixedData.signatureCity),
    data_assinatura_extenso: formatLongDate(snapshot.fixedData.signatureDate)
  };
}

function getTemplateVersion(snapshot: TceConfigurationSnapshot) {
  const resolvedVersion = getOptionalText(snapshot.model.templateVersion);
  return TEMPLATE_SUPPORTED_VERSIONS.has(resolvedVersion)
    ? UNIP_TCE_DOCX_TEMPLATE_VERSION
    : UNIP_TCE_DOCX_TEMPLATE_VERSION;
}

export async function buildStudentTceDocxBuffer(input: TceDocxRenderInput) {
  const templateVersion = getTemplateVersion(input.snapshot);
  const templatePath =
    templateVersion === UNIP_TCE_DOCX_TEMPLATE_VERSION
      ? path.join(process.cwd(), UNIP_TCE_DOCX_TEMPLATE_PATH)
      : path.join(process.cwd(), UNIP_TCE_DOCX_TEMPLATE_PATH);
  const templateBytes = await readFile(templatePath);
  const zip = new PizZip(templateBytes);
  const templateData = buildStudentTceTemplateData(input);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("O template oficial do TCE não possui word/document.xml.");
  }

  try {
    const normalizedXml = normalizeTemplateXmlPlaceholders(
      documentFile.asText(),
      Object.keys(templateData)
    );
    const populatedXml = applyTemplateValues(normalizedXml, templateData);
    zip.file("word/document.xml", populatedXml);
  } catch {
    throw new Error("Houve um problema ao preencher o template oficial do TCE.");
  }

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE"
  }) as Buffer;
}
