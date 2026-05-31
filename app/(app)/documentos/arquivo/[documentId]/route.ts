import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getAccessibleStudentDocumentForDownload } from "@/services/student-documents";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  props: {
    params: Promise<{
      documentId: string;
    }>;
  }
) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return new NextResponse("Não autenticado.", { status: 401 });
  }

  const params = await props.params;
  const download = await getAccessibleStudentDocumentForDownload(
    currentUser,
    params.documentId
  );

  if (!download) {
    return new NextResponse("Documento não encontrado ou indisponível.", {
      status: 404
    });
  }

  const response = NextResponse.redirect(download.url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
