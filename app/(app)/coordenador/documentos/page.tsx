import type { Route } from "next";
import { StudentDocumentDirectoryScreen } from "@/components/documents/student-document-directory-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDirectoryPageData } from "@/services/student-documents";

export default async function CoordinatorStudentDocumentsPage(props: {
  searchParams?: Promise<{
    q?: string;
    area_id?: string;
    status?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const pageData = await getStudentDocumentDirectoryPageData({
    currentUser,
    viewerRole: "coordenador",
    search: searchParams.q ?? null,
    areaId: searchParams.area_id ?? null,
    status: searchParams.status ?? null
  });

  return (
    <StudentDocumentDirectoryScreen
      pageData={pageData}
      basePath={"/coordenador/documentos" as Route}
      heroEyebrow="Documentos institucionais"
      heroTitle="Documentos dos alunos"
      heroDescription="A coordenação acompanha os documentos da unidade, pode intervir na validação e garante a coerência institucional da carteira de vacinação e dos TCEs."
    />
  );
}
