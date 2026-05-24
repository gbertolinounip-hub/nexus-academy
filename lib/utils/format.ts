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

