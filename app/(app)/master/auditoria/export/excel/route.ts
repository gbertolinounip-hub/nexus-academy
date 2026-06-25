import {
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  buildXlsxDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildMasterGlobalAuditWorkbook,
  getMasterGlobalAuditFileBaseName
} from "@/services/master-audit-export";
import { getMasterGlobalAuditPageData } from "@/services/master";
import {
  buildInstitutionalReportHeaderRows,
  loadInstitutionalReportBrandingByInstitutionId,
  loadInstitutionalReportBrandingForCurrentUser,
  resolveNamedScopeValue
} from "@/services/report-branding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  if (currentUser.role !== "coordenador_master") {
    return new Response("Acesso negado.", { status: 403 });
  }

  const pageData = await getMasterGlobalAuditPageData({
    institutionId: readRequestQuery(request, "instituicao") ?? undefined,
    unitId: readRequestQuery(request, "unidade") ?? undefined,
    courseId: readRequestQuery(request, "curso") ?? undefined,
    role: readRequestQuery(request, "perfil") ?? undefined,
    period: readRequestQuery(request, "periodo") ?? undefined
  });

  if (!pageData) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar os eventos da auditoria global."
    );
  }

  const reportBranding =
    (await loadInstitutionalReportBrandingByInstitutionId(pageData.filters.institutionId)) ??
    (await loadInstitutionalReportBrandingForCurrentUser(currentUser));
  const headerRows = buildInstitutionalReportHeaderRows(reportBranding, {
    reportName: "Auditoria Global",
    courseName: resolveNamedScopeValue(
      pageData.courses.map((course) => ({
        id: course.id,
        name: course.code ? `${course.code} - ${course.name}` : course.name
      })),
      pageData.filters.courseId
    ),
    unitName: resolveNamedScopeValue(
      pageData.units.map((unit) => ({ id: unit.id, name: unit.name })),
      pageData.filters.unitId
    )
  });

  return buildXlsxDownloadResponse(
    getMasterGlobalAuditFileBaseName(pageData),
    buildMasterGlobalAuditWorkbook(pageData, headerRows)
  );
}
