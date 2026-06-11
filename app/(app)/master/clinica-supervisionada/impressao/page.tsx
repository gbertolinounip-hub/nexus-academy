import { SectionCard } from "@/components/common/section-card";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import {
  ClinicalInstitutionalDashboardPrintSections,
  buildClinicalInstitutionalDashboardQuery
} from "@/components/clinical/clinical-institutional-dashboard";
import { requireRole } from "@/lib/auth/session";
import { getClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

export default async function MasterClinicalInstitutionalDashboardPrintPage(props: {
  searchParams?: Promise<{
    institution_id?: string;
    unit_id?: string;
    semester_id?: string;
    area_id?: string;
    professor_id?: string;
    student_id?: string;
    status?: string;
    print?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador_master"]);
  const searchParams = (await props.searchParams) ?? {};
  const shouldAutoPrint = searchParams.print === "1";
  const { pageData, emptyState } = await getClinicalInstitutionalDashboardPageData(
    currentUser,
    {
      institutionId: searchParams.institution_id ?? null,
      unitId: searchParams.unit_id ?? null,
      semesterId: searchParams.semester_id ?? null,
      areaId: searchParams.area_id ?? null,
      professorId: searchParams.professor_id ?? null,
      studentId: searchParams.student_id ?? null,
      status: searchParams.status ?? null
    }
  );

  const backQuery = pageData
    ? buildClinicalInstitutionalDashboardQuery(pageData.filters)
    : "";
  const backHref = backQuery
    ? `/master/clinica-supervisionada${backQuery}`
    : "/master/clinica-supervisionada";

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        title="Relatório clínico institucional global"
        subtitle="Visão consolidada multiunidade para acompanhamento da Clínica Supervisionada."
        backHref={backHref}
        backLabel="Voltar à gestão clínica global"
        autoPrint={shouldAutoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Relatório indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível montar o relatório clínico institucional global neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os dados clínicos das unidades estiverem disponíveis, o
            relatório poderá ser gerado aqui.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      title="Relatório clínico institucional global"
      subtitle="Consolidado multiunidade da Clínica Supervisionada."
      backHref={backHref}
      backLabel="Voltar à gestão clínica global"
      autoPrint={shouldAutoPrint}
    >
      <ClinicalInstitutionalDashboardPrintSections pageData={pageData} />
    </ClinicalPrintDocument>
  );
}
