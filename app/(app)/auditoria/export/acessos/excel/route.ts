import {
  buildExcelDownloadResponse,
  buildUnauthorizedDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildAccessLogWorkbook,
  getAccessLogFileBaseName
} from "@/services/report-exports";
import { getCoordinatorAccessLogExport } from "@/services/access-logs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  if (currentUser.role !== "coordenador" || !currentUser.unitId) {
    return new Response("Acesso negado.", { status: 403 });
  }

  const exportData = await getCoordinatorAccessLogExport(currentUser, {
    startDate: readRequestQuery(request, "inicio"),
    endDate: readRequestQuery(request, "fim")
  });

  if (!exportData) {
    return new Response("Não foi possível exportar os acessos da unidade.", {
      status: 404
    });
  }

  return buildExcelDownloadResponse(
    getAccessLogFileBaseName(exportData.unitName),
    await buildAccessLogWorkbook(exportData)
  );
}
