export function formatPercentage(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function formatGradeOutOfTen(value: number) {
  return value.toFixed(2).replace(".", ",");
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateOnlyValue(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return DATE_ONLY_PATTERN.test(normalizedValue) ? normalizedValue : null;
}

function buildUtcNoonDateFromDateOnly(value: string) {
  const normalizedValue = normalizeDateOnlyValue(value);

  if (!normalizedValue) {
    return null;
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function parseDateValue(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    return null;
  }

  const dateOnly = buildUtcNoonDateFromDateOnly(normalizedValue);

  if (dateOnly) {
    return dateOnly;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function getDateValueTimestamp(value?: string | null) {
  return parseDateValue(value)?.getTime() ?? null;
}

export function getClinicalWeekdayFromDateOnly(
  value: string
): "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | null {
  const referenceDate = buildUtcNoonDateFromDateOnly(value);

  if (!referenceDate) {
    return null;
  }

  switch (referenceDate.getUTCDay()) {
    case 1:
      return "segunda";
    case 2:
      return "terca";
    case 3:
      return "quarta";
    case 4:
      return "quinta";
    case 5:
      return "sexta";
    case 6:
      return "sabado";
    default:
      return null;
  }
}

export function formatDate(value: string) {
  const dateOnlyValue = normalizeDateOnlyValue(value);

  if (dateOnlyValue) {
    const [year, month, day] = dateOnlyValue.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsedDate);
}

export function formatDateTime(value: string) {
  const dateOnlyValue = normalizeDateOnlyValue(value);

  if (dateOnlyValue) {
    return formatDate(dateOnlyValue);
  }

  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsedDate);
}

export function formatTime(value: string) {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsedDate);
}

export function formatLaunchType(value: string) {
  switch (value) {
    case "parcial":
      return "Parcial";
    case "revisao":
      return "Revisão";
    case "fechamento":
      return "Fechamento";
    default:
      return value;
  }
}

export function formatStudentStatusBadge(value: string) {
  switch (value) {
    case "critico":
      return "Crítico";
    case "atencao":
      return "Atenção";
    case "bem":
      return "Satisfatório";
    default:
      return value;
  }
}

export function formatEvaluationStatus(value: string) {
  switch (value) {
    case "rascunho":
      return "Rascunho";
    case "publicado":
      return "Publicado";
    case "cancelado":
      return "Cancelado";
    default:
      return value;
  }
}

export function formatClinicalCaseStatus(value: string) {
  switch (value) {
    case "atribuido":
      return "Atribuído";
    case "ativo":
      return "Ativo";
    case "alta":
      return "Alta";
    case "encerrado":
      return "Encerrado";
    default:
      return value;
  }
}

export function formatClinicalRecordStatus(value: string) {
  switch (value) {
    case "rascunho":
      return "Rascunho";
    case "enviado":
      return "Enviado";
    case "aprovado":
      return "Aprovado";
    case "ajustes_solicitados":
      return "Ajustes solicitados";
    default:
      return value;
  }
}

export function formatClinicalAttendancePresenceStatus(value: string) {
  switch (value) {
    case "presente":
      return "Paciente presente";
    case "ausente":
      return "Paciente ausente";
    case "cancelado":
      return "Atendimento cancelado";
    default:
      return value;
  }
}

export function formatClinicalAttendanceEvolutionStatus(value: string) {
  switch (value) {
    case "dispensada":
      return "Dispensada";
    case "pendente":
      return "Pendente";
    case "enviada":
      return "Enviada";
    case "ajustes_solicitados":
      return "Ajustes solicitados";
    case "aprovada":
      return "Aprovada";
    case "reprovada":
      return "Reprovada";
    default:
      return value;
  }
}

export function formatClinicalRecordType(value: string) {
  switch (value) {
    case "avaliacao":
      return "Avaliação";
    case "plano_tratamento":
      return "Plano de tratamento";
    case "evolucao":
      return "Evolução";
    default:
      return value;
  }
}

export function formatStudentDocumentType(value: string) {
  switch (value) {
    case "carteira_vacinacao":
      return "Carteira de vacinação";
    case "tce":
      return "TCE";
    case "obrigatorio_generico":
      return "Documento obrigatório";
    default:
      return value;
  }
}

export function formatStudentDocumentReviewerRole(value: string | null | undefined) {
  switch (value) {
    case "professor":
      return "Professor";
    case "coordenador":
      return "Coordenação";
    default:
      return null;
  }
}

export function formatStudentDocumentStatus(
  value: string,
  reviewerRole?: string | null
) {
  if (value === "aprovado") {
    return reviewerRole === "coordenador"
      ? "Aprovado pela coordenação"
      : "Aprovado pelo professor";
  }

  if (value === "reprovado") {
    return reviewerRole === "coordenador"
      ? "Reprovado pela coordenação"
      : "Reprovado pelo professor";
  }

  return "Enviado";
}

export function formatClinicalWeekday(value: string) {
  switch (value) {
    case "segunda":
      return "Segunda-feira";
    case "terca":
      return "Terça-feira";
    case "quarta":
      return "Quarta-feira";
    case "quinta":
      return "Quinta-feira";
    case "sexta":
      return "Sexta-feira";
    case "sabado":
      return "Sábado";
    default:
      return value;
  }
}

export function formatClinicalScheduleLabel(weekday: string, appointmentTime: string) {
  return `${formatClinicalWeekday(weekday)} às ${appointmentTime}`;
}

export function formatMaskedFirstName(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "";
  }

  const firstName = normalizedValue.split(/\s+/)[0] ?? "";
  const characters = Array.from(firstName);

  if (!characters.length) {
    return "";
  }

  const visibleCharacter = characters[0] ?? "";
  const maskLength = Math.max(characters.length - 1, 1);

  return `${visibleCharacter}${"*".repeat(maskLength)}`;
}

export function formatLaunchIdentity(launchType: string, value: string) {
  return `${formatLaunchType(launchType)} - ${formatDate(value)}`;
}

export interface LaunchIdentityDisplay {
  label: string;
  effectiveDateValue: string | null;
  isLegacyRecord: boolean;
  source: "avaliado_em" | "referencia" | "created_at" | "unavailable";
}

const KNOWN_MOJIBAKE_REPAIRS = [
  ["â€”", "-"],
  ["â€“", "-"],
  ["Â·", "·"],
  ["Ã§", "ç"],
  ["Ã£", "ã"],
  ["Ã¡", "á"],
  ["Ã ", "à"],
  ["Ã¢", "â"],
  ["Ã©", "é"],
  ["Ãª", "ê"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã´", "ô"],
  ["Ãµ", "õ"],
  ["Ãº", "ú"],
  ["Ã", "Á"],
  ["Ã€", "À"],
  ["Ã‚", "Â"],
  ["Ã‰", "É"],
  ["ÃŠ", "Ê"],
  ["Ã“", "Ó"],
  ["Ã”", "Ô"],
  ["Ã•", "Õ"],
  ["Ãš", "Ú"],
  ["Ã‡", "Ç"]
] as const;

export function repairKnownMojibake(value: string) {
  return KNOWN_MOJIBAKE_REPAIRS.reduce(
    (normalizedValue, [source, target]) =>
      normalizedValue.replaceAll(source, target),
    value
  );
}

function normalizeText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = repairKnownMojibake(value).trim();
  return trimmedValue ? trimmedValue : null;
}

export function joinDisplayParts(
  parts: Array<string | null | undefined>,
  separator = " · "
) {
  return parts
    .map((part) => normalizeText(part))
    .filter((part): part is string => Boolean(part))
    .join(separator);
}

export function formatStageAreaLabel(areaName?: string | null) {
  return normalizeText(areaName) ?? "Área não identificada";
}

export function formatStageAreaDisplayFromLegacyLabel(label?: string | null) {
  const normalizedLabel = normalizeText(label);

  if (!normalizedLabel) {
    return "Área não identificada";
  }

  const parts = normalizedLabel
    .split("·")
    .map((part) => normalizeText(part))
    .filter((part): part is string => Boolean(part));

  return formatStageAreaLabel(parts.at(-1) ?? normalizedLabel);
}

export function formatStageAssignmentLabel(input: {
  semesterCode?: string | null;
  areaName?: string | null;
}) {
  return joinDisplayParts(
    [input.semesterCode, formatStageAreaLabel(input.areaName)],
    " - "
  );
}

function isValidDateValue(value?: string | null) {
  return parseDateValue(normalizeText(value)) !== null;
}

export function resolveLaunchIdentity(input: {
  launchType: string;
  evaluatedAt?: string | null;
  reference?: string | null;
  createdAt?: string | null;
}): LaunchIdentityDisplay {
  if (isValidDateValue(input.evaluatedAt)) {
    return {
      label: formatLaunchIdentity(input.launchType, input.evaluatedAt!),
      effectiveDateValue: input.evaluatedAt!,
      isLegacyRecord: false,
      source: "avaliado_em"
    };
  }

  const normalizedReference = normalizeText(input.reference);

  if (normalizedReference) {
    return {
      label: normalizedReference,
      effectiveDateValue: isValidDateValue(input.createdAt) ? input.createdAt! : null,
      isLegacyRecord: true,
      source: "referencia"
    };
  }

  if (isValidDateValue(input.createdAt)) {
    return {
      label: formatLaunchIdentity(input.launchType, input.createdAt!),
      effectiveDateValue: input.createdAt!,
      isLegacyRecord: true,
      source: "created_at"
    };
  }

  return {
    label: `${formatLaunchType(input.launchType)} - data indisponível`,
    effectiveDateValue: null,
    isLegacyRecord: true,
    source: "unavailable"
  };
}

