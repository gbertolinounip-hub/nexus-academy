import type { Route } from "next";
import { StudentDocumentDirectoryScreen } from "@/components/documents/student-document-directory-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDirectoryPageData } from "@/services/student-documents";

export default async function MasterStudentDocumentsPage(props: {
  searchParams?: Promise<{
    q?: string;
    institution_id?: string;
    unit_id?: string;
    area_id?: string;
    status?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador_master"]);
  const searchParams = (await props.searchParams) ?? {};
  const pageData = await getStudentDocumentDirectoryPageData({
    currentUser,
    viewerRole: "coordenador_master",
    search: searchParams.q ?? null,
    institutionId: searchParams.institution_id ?? null,
    areaId: searchParams.area_id ?? null,
    status: searchParams.status ?? null,
    unitId: searchParams.unit_id ?? null
  });

  return (
    <StudentDocumentDirectoryScreen
      pageData={pageData}
      basePath={"/master/documentos" as Route}
      heroEyebrow="Documentos institucionais globais"
      heroTitle="Documentos dos alunos"
      heroDescription="Visão multiunidade da documentação dos alunos, com filtros por unidade e leitura institucional global da carteira de vacinação e dos TCEs."
    />
  );
}
