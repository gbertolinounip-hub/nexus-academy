export function formatPercentage(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function formatGradeOutOfTen(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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

function isValidDateValue(value?: string | null) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return false;
  }

  return !Number.isNaN(new Date(normalizedValue).getTime());
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

