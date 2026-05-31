import type { Route } from "next";
import { StudentDocumentDirectoryScreen } from "@/components/documents/student-document-directory-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDirectoryPageData } from "@/services/student-documents";

export default async function ProfessorStudentDocumentsPage(props: {
  searchParams?: Promise<{
    q?: string;
    area_id?: string;
    status?: string;
  }>;
}) {
  const currentUser = await requireRole(["professor"]);
  const searchParams = (await props.searchParams) ?? {};
  const pageData = await getStudentDocumentDirectoryPageData({
    currentUser,
    viewerRole: "professor",
    search: searchParams.q ?? null,
    areaId: searchParams.area_id ?? null,
    status: searchParams.status ?? null
  });

  return (
    <StudentDocumentDirectoryScreen
      pageData={pageData}
      basePath={"/professor/documentos" as Route}
      heroEyebrow="Documentos dos alunos"
      heroTitle="Validação documental"
      heroDescription="Acompanhe a carteira de vacinação e os TCEs dos alunos sob sua supervisão, com foco em análise inicial, aprovações e reprovações justificadas."
    />
  );
}
