import {
  buildExcelDownloadResponse,
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildStudentWorkbook,
  getStudentFileBaseName
} from "@/services/report-exports";
import {
  buildInstitutionalReportHeaderRows,
  loadInstitutionalReportBrandingForCurrentUser,
  resolveCurrentUserCourseName,
  resolveCurrentUserUnitName
} from "@/services/report-branding";
import { getAuthenticatedStudentFinalReport } from "@/services/reports";

export const runtime = "nodejs";

interface StudentExcelRouteProps {
  params: Promise<{
    studentId: string;
  }>;
}

export async function GET(request: Request, props: StudentExcelRouteProps) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const { studentId } = await props.params;
  const requestedSemesterId = readRequestQuery(request, "semestre");
  const requestedEnrollmentId = readRequestQuery(request, "matricula");
  const origin = readRequestQuery(request, "from");
  const { report } = await getAuthenticatedStudentFinalReport(
    currentUser,
    studentId,
    requestedSemesterId,
    requestedEnrollmentId,
    origin === "audit"
      ? {
          includeHistoricalStudents: true
        }
      : undefined
  );

  if (!report) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar o aluno solicitado."
    );
  }

  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const headerRows = buildInstitutionalReportHeaderRows(reportBranding, {
    reportName:
      report.reportContext.kind === "area"
        ? "Relatório final da área"
        : "Relatório final por aluno",
    courseName: resolveCurrentUserCourseName(currentUser),
    unitName: resolveCurrentUserUnitName(currentUser),
    semesterName: `${report.selectedSemester.code} · ${report.selectedSemester.name}`
  });

  return buildExcelDownloadResponse(
    getStudentFileBaseName(report),
    await buildStudentWorkbook(report, headerRows)
  );
}
