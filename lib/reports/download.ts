import { getCurrentAppUser } from "@/lib/auth/session";

export async function requireExportUser() {
  return getCurrentAppUser();
}

export function readRequestQuery(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key);
}

export function buildCsvDownloadResponse(filename: string, content: string) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}

export function buildExcelDownloadResponse(filename: string, content: Buffer) {
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.xls"`,
      "Cache-Control": "no-store"
    }
  });
}

export function buildXlsxDownloadResponse(filename: string, content: Buffer) {
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}

export function buildUnauthorizedDownloadResponse() {
  return new Response("Não autenticado.", { status: 401 });
}

export function buildUnavailableDownloadResponse(message: string, status = 404) {
  return new Response(message, { status });
}

