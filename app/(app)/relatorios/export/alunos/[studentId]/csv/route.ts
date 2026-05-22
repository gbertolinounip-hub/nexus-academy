import {
  buildCsvDownloadResponse,
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildStudentCsv,
  getStudentFileBaseName
} from "@/services/report-exports";
import { getAuthenticatedStudentFinalReport } from "@/services/reports";

export const runtime = "nodejs";

interface StudentCsvRouteProps {
  params: Promise<{
    studentId: string;
  }>;
}

export async function GET(request: Request, props: StudentCsvRouteProps) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const { studentId } = await props.params;
  const requestedSemesterId = readRequestQuery(request, "semestre");
  const requestedEnrollmentId = readRequestQuery(request, "matricula");
  const { report } = await getAuthenticatedStudentFinalReport(
    currentUser,
    studentId,
    requestedSemesterId,
    requestedEnrollmentId
  );

  if (!report) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar o aluno solicitado."
    );
  }

  return buildCsvDownloadResponse(
    getStudentFileBaseName(report),
    buildStudentCsv(report)
  );
}

