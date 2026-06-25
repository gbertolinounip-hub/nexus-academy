import { formatDateTime } from "@/lib/utils/format";
import {
  loadInstitutionBrandingByInstitutionId,
  loadInstitutionBrandingForCurrentUser
} from "@/services/institution-branding";
import type { SessionUser } from "@/types/domain";

export interface InstitutionalReportBranding {
  institutionId: string | null;
  institutionDisplayName: string | null;
  institutionLogoUrl: string | null;
  systemName: string;
  systemSubtitle: string;
}

export interface InstitutionalReportHeaderRow {
  label: string;
  value: string;
}

export interface InstitutionalReportHeaderContext {
  reportName: string;
  courseName?: string | null;
  unitName?: string | null;
  semesterName?: string | null;
  emittedAt?: string | null;
}

export async function loadInstitutionalReportBrandingForCurrentUser(
  currentUser: SessionUser
): Promise<InstitutionalReportBranding | null> {
  const branding = await loadInstitutionBrandingForCurrentUser(currentUser);

  return normalizeInstitutionalReportBranding(branding);
}

export async function loadInstitutionalReportBrandingByInstitutionId(
  institutionId: string | null | undefined
): Promise<InstitutionalReportBranding | null> {
  const branding = await loadInstitutionBrandingByInstitutionId(institutionId);

  return normalizeInstitutionalReportBranding(branding);
}

function normalizeInstitutionalReportBranding(
  branding: Awaited<ReturnType<typeof loadInstitutionBrandingByInstitutionId>> | null
) {
  if (!branding) {
    return null;
  }

  return {
    institutionId: branding.institutionId,
    institutionDisplayName: branding.displayName,
    institutionLogoUrl: branding.primaryLogoUrl ?? branding.compactLogoUrl ?? null,
    systemName: "Nexus Academy",
    systemSubtitle: "Gestão de estágios e desempenho acadêmico"
  };
}

export function resolveCurrentUserCourseName(currentUser: SessionUser) {
  return currentUser.contextoAtivo?.cursoNome ?? currentUser.cursoNome ?? null;
}

export function resolveCurrentUserUnitName(currentUser: SessionUser) {
  return currentUser.contextoAtivo?.unidadeNome ?? currentUser.unitName ?? null;
}

export function resolveNamedScopeValue(
  options: Array<{ id: string; name: string }>,
  selectedId: string | null | undefined
) {
  if (!selectedId) {
    return null;
  }

  return options.find((option) => option.id === selectedId)?.name ?? selectedId;
}

export function buildInstitutionalReportHeaderRows(
  branding: InstitutionalReportBranding | null,
  context: InstitutionalReportHeaderContext
): InstitutionalReportHeaderRow[] {
  const rows: InstitutionalReportHeaderRow[] = [];

  if (branding?.institutionDisplayName) {
    rows.push({
      label: "Instituição",
      value: branding.institutionDisplayName
    });
  }

  rows.push({
    label: "Sistema",
    value: branding?.systemName ?? "Nexus Academy"
  });
  rows.push({
    label: "Relatório",
    value: context.reportName
  });

  if (context.courseName?.trim()) {
    rows.push({
      label: "Curso",
      value: context.courseName.trim()
    });
  }

  if (context.unitName?.trim()) {
    rows.push({
      label: "Unidade",
      value: context.unitName.trim()
    });
  }

  if (context.semesterName?.trim()) {
    rows.push({
      label: "Semestre",
      value: context.semesterName.trim()
    });
  }

  rows.push({
    label: "Emitido em",
    value: formatDateTime(context.emittedAt ?? new Date().toISOString())
  });

  return rows;
}
