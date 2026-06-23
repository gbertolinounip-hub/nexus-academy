import {
  buildUnauthorizedDownloadResponse,
  buildUnavailableDownloadResponse,
  buildXlsxDownloadResponse,
  readRequestQuery,
  requireExportUser
} from "@/lib/reports/download";
import {
  buildClinicalAttendanceIndicatorsWorkbook,
  getClinicalAttendanceIndicatorsFileBaseName
} from "@/services/clinical-indicators-export";
import {
  getClinicalAttendanceIndicatorsPageData
} from "@/services/clinical-indicators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await requireExportUser();

  if (!currentUser) {
    return buildUnauthorizedDownloadResponse();
  }

  const { pageData } = await getClinicalAttendanceIndicatorsPageData(currentUser, {
    dateFrom: readRequestQuery(request, "dateFrom"),
    dateTo: readRequestQuery(request, "dateTo"),
    institutionId: readRequestQuery(request, "institutionId"),
    courseId: readRequestQuery(request, "courseId"),
    unitId: readRequestQuery(request, "unitId"),
    areaId: readRequestQuery(request, "areaId"),
    professorId: readRequestQuery(request, "professorId"),
    studentId: readRequestQuery(request, "studentId"),
    statusEvolucao: readRequestQuery(request, "statusEvolucao")
  });

  if (!pageData) {
    return buildUnavailableDownloadResponse(
      "Não foi possível exportar os indicadores clínicos solicitados."
    );
  }

  if (pageData.viewerRole !== "coordenador") {
    return buildUnavailableDownloadResponse(
      "Acesso negado para exportar este indicador clínico.",
      403
    );
  }

  return buildXlsxDownloadResponse(
    getClinicalAttendanceIndicatorsFileBaseName(pageData),
    buildClinicalAttendanceIndicatorsWorkbook(pageData)
  );
}
