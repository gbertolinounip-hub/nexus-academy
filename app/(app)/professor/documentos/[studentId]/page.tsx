import { notFound } from "next/navigation";
import type { Route } from "next";
import { StudentDocumentDetailScreen } from "@/components/documents/student-document-detail-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDetailPageData } from "@/services/student-documents";

export default async function ProfessorStudentDocumentDetailPage(props: {
  params: Promise<{
    studentId: string;
  }>;
}) {
  const currentUser = await requireRole(["professor"]);
  const params = await props.params;
  const pageData = await getStudentDocumentDetailPageData({
    currentUser,
    viewerRole: "professor",
    studentId: params.studentId
  });

  if (!pageData) {
    notFound();
  }

  return (
    <StudentDocumentDetailScreen
      pageData={pageData}
      backHref={"/professor/documentos" as Route}
      backLabel="Voltar para documentos"
      heroEyebrow="Documentos dos alunos"
      heroTitle={pageData.student.name}
      heroDescription="Revise a carteira de vacinação e os TCEs do aluno, registrando aprovação ou reprovação com justificativa obrigatória."
    />
  );
}
