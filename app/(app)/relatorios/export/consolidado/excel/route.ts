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

  return buildExcelDownloadResponse(
    getConsolidatedFileBaseName(reports),
    await buildConsolidatedWorkbook(reports)
  );
}

