import type { Route } from "next";
import type {
  ContextProfileCode,
  ProfileCode,
  SessionUser,
  SessionUserContext
} from "@/types/domain";

const legacyProfileCodes = [
  "aluno",
  "professor",
  "secretaria",
  "coordenador",
  "coordenador_master"
] as const satisfies ProfileCode[];

const knownContextProfileCodes = [
  ...legacyProfileCodes,
  "master_curso"
] as const satisfies ContextProfileCode[];

export const roleLabels: Record<ProfileCode, string> = {
  aluno: "Aluno",
  professor: "Professor",
  secretaria: "Secretaria",
  coordenador: "Coordenador",
  coordenador_master: "Coordenador master"
};

export const contextRoleLabels: Record<ContextProfileCode, string> = {
  ...roleLabels,
  master_curso: "Gestor do curso"
};

export function getContextRoleDisplayName(
  profileCode: ContextProfileCode,
  persistedName?: string | null
) {
  if (profileCode === "master_curso") {
    return contextRoleLabels[profileCode];
  }

  return persistedName ?? contextRoleLabels[profileCode];
}

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sanitizeCompactToken(value: string) {
  return normalizeAscii(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function abbreviateLabelToken(value: string) {
  const tokens = normalizeAscii(value)
    .split(/[\s/_-]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 0 &&
        !["de", "da", "do", "das", "dos", "e", "campus", "unidade"].includes(
          token.toLowerCase()
        )
    );

  if (!tokens.length) {
    return null;
  }

  if (tokens.length >= 2) {
    return tokens
      .slice(0, 3)
      .map((token) => token[0] ?? "")
      .join("")
      .toUpperCase();
  }

  return tokens[0].slice(0, 4).toUpperCase();
}

function buildCourseCompactToken(context: SessionUserContext) {
  if (context.cursoCodigo) {
    return sanitizeCompactToken(context.cursoCodigo).slice(0, 8);
  }

  if (context.cursoNome) {
    return abbreviateLabelToken(context.cursoNome);
  }

  return null;
}

function buildUnitCompactToken(context: SessionUserContext) {
  if (context.unidadeSigla) {
    return sanitizeCompactToken(context.unidadeSigla).slice(0, 6);
  }

  if (context.unidadeSlug) {
    return abbreviateLabelToken(context.unidadeSlug.replace(/[-_]+/g, " "));
  }

  if (context.unidadeNome) {
    return abbreviateLabelToken(context.unidadeNome);
  }

  if (context.ofertaNome) {
    return abbreviateLabelToken(context.ofertaNome);
  }

  return null;
}

export function buildContextShortLabel(context: SessionUserContext) {
  const courseToken = buildCourseCompactToken(context);
  const unitToken = buildUnitCompactToken(context);

  if (courseToken && unitToken) {
    return `${courseToken}-${unitToken}`;
  }

  if (courseToken) {
    return courseToken;
  }

  if (unitToken) {
    return unitToken;
  }

  return getContextRoleDisplayName(context.perfilCodigo, context.perfilNome);
}

export function buildContextLongLabel(context: SessionUserContext) {
  const primaryLabel =
    context.cursoNome ??
    context.cursoCodigo ??
    getContextRoleDisplayName(context.perfilCodigo, context.perfilNome);
  const scopeParts =
    context.perfilCodigo === "master_curso"
      ? [context.instituicaoNome]
      : [context.instituicaoNome, context.unidadeNome ?? context.ofertaNome];
  const scopeLabel = scopeParts.filter((part): part is string => Boolean(part)).join(" / ");

  return scopeLabel ? `${primaryLabel} - ${scopeLabel}` : primaryLabel;
}

export const defaultDashboardPath: Record<ProfileCode, Route> = {
  aluno: "/aluno" as Route,
  professor: "/professor" as Route,
  secretaria: "/secretaria" as Route,
  coordenador: "/coordenador" as Route,
  coordenador_master: "/master" as Route
};

export function getDefaultDashboardPathForUser(
  user: Pick<SessionUser, "role" | "contextoAtivo">
): Route {
  if (getActiveMasterCourseContext(user)) {
    return "/master-curso" as Route;
  }

  return defaultDashboardPath[user.role];
}

export function isProfileCode(value: string): value is ProfileCode {
  return legacyProfileCodes.includes(value as ProfileCode);
}

export function isContextProfileCode(value: string): value is ContextProfileCode {
  return knownContextProfileCodes.includes(value as ContextProfileCode);
}

export function getActiveContextByProfile(
  user: Pick<SessionUser, "contextoAtivo">,
  perfilCodigo: ContextProfileCode
) {
  const activeContext = user.contextoAtivo ?? null;

  if (!activeContext || !activeContext.ativo || activeContext.perfilCodigo !== perfilCodigo) {
    return null;
  }

  return activeContext;
}

export function getActiveMasterCourseContext(
  user: Pick<SessionUser, "contextoAtivo">
): (SessionUserContext & {
  perfilCodigo: "master_curso";
  instituicaoId: string;
  cursoId: string;
}) | null {
  const activeContext = getActiveContextByProfile(user, "master_curso");

  if (!activeContext?.instituicaoId || !activeContext.cursoId) {
    return null;
  }

  return {
    ...activeContext,
    perfilCodigo: "master_curso",
    instituicaoId: activeContext.instituicaoId,
    cursoId: activeContext.cursoId
  };
}

export const roleCapabilities = {
  aluno: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: false,
    canAudit: false
  },
  professor: {
    canEditGrades: true,
    canEditAbsences: true,
    canManageStructure: false,
    canAudit: false
  },
  secretaria: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: false,
    canAudit: false
  },
  coordenador: {
    canEditGrades: true,
    canEditAbsences: true,
    canManageStructure: true,
    canAudit: true
  },
  coordenador_master: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: true,
    canAudit: true
  }
} as const satisfies Record<
  ProfileCode,
  {
    canEditGrades: boolean;
    canEditAbsences: boolean;
    canManageStructure: boolean;
    canAudit: boolean;
  }
>;
