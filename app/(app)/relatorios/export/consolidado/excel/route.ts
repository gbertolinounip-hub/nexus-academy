import {
  buildExcelDownloadResponse,
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildConsolidatedWorkbook,
  getConsolidatedFileBaseName
} from "@/services/report-exports";
import {
  buildInstitutionalReportHeaderRows,
  loadInstitutionalReportBrandingForCurrentUser,
  resolveCurrentUserCourseName,
  resolveCurrentUserUnitName
} from "@/services/report-branding";
import { getAuthenticatedReportsPageData } from "@/services/reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const requestedSemesterId = readRequestQuery(request, "semestre");
  const { reports } = await getAuthenticatedReportsPageData(
    currentUser,
    requestedSemesterId
  );

  if (!reports) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar o consolidado solicitado."
    );
  }

  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const headerRows = buildInstitutionalReportHeaderRows(reportBranding, {
    reportName: "Relatórios finais acadêmicos",
    courseName: resolveCurrentUserCourseName(currentUser),
    unitName: resolveCurrentUserUnitName(currentUser),
    semesterName: `${reports.selectedSemester.code} · ${reports.selectedSemester.name}`
  });

  return buildExcelDownloadResponse(
    getConsolidatedFileBaseName(reports),
    await buildConsolidatedWorkbook(reports, headerRows)
  );
}
