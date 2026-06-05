import {
  buildCsvDownloadResponse,
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildClassCsv,
  getClassFileBaseName
} from "@/services/report-exports";
import { getAuthenticatedClassFinalReport } from "@/services/reports";

export const runtime = "nodejs";

interface ClassCsvRouteProps {
  params: Promise<{
    classId: string;
  }>;
}

export async function GET(request: Request, props: ClassCsvRouteProps) {
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

  return buildCsvDownloadResponse(
    getClassFileBaseName(report),
    buildClassCsv(report)
  );
}

