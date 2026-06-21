import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getStudentTceDocumentDownloadUrl } from "@/services/tce";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  props: {
    params: Promise<{
      configurationId: string;
    }>;
  }
) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser || currentUser.role !== "aluno") {
    return new NextResponse("Não autenticado.", { status: 401 });
  }

  const params = await props.params;
  const download = await getStudentTceDocumentDownloadUrl(
    currentUser,
    params.configurationId
  );

  if (!download) {
    return new NextResponse("TCE em Word não encontrado ou indisponível.", {
      status: 404
    });
  }

  const response = NextResponse.redirect(download.url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
