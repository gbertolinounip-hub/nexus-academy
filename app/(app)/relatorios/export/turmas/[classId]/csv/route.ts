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

export async function GET(_request: Request, props: ClassCsvRouteProps) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const { classId } = await props.params;
  const { report } = await getAuthenticatedClassFinalReport(currentUser, classId);

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

