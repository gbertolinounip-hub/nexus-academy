import {
  buildExcelDownloadResponse,
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildClassWorkbook,
  getClassFileBaseName
} from "@/services/report-exports";
import {
  buildInstitutionalReportHeaderRows,
  loadInstitutionalReportBrandingForCurrentUser,
  resolveCurrentUserCourseName,
  resolveCurrentUserUnitName
} from "@/services/report-branding";
import { getAuthenticatedClassFinalReport } from "@/services/reports";

export const runtime = "nodejs";

interface ClassExcelRouteProps {
  params: Promise<{
    classId: string;
  }>;
}

export async function GET(request: Request, props: ClassExcelRouteProps) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const { classId } = await props.params;
  const requestUrl = new URL(request.url);
  const semesterId = requestUrl.searchParams.get("semestre");
  const { report } = await getAuthenticatedClassFinalReport(
    currentUser,
    classId,
    semesterId
      ? {
          semesterId,
          includeHistoricalStudents: true
        }
      : undefined
  );

  if (!report) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar a turma solicitada."
    );
  }

  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const headerRows = buildInstitutionalReportHeaderRows(reportBranding, {
    reportName: "Relatório final por turma",
    courseName: resolveCurrentUserCourseName(currentUser),
    unitName: resolveCurrentUserUnitName(currentUser),
    semesterName: `${report.classGroup.semesterCode} · ${report.classGroup.semesterName}`
  });

  return buildExcelDownloadResponse(
    getClassFileBaseName(report),
    await buildClassWorkbook(report, headerRows)
  );
}
