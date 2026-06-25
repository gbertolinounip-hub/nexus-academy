import { SectionCard } from "@/components/common/section-card";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import {
  ClinicalInstitutionalDashboardPrintSections,
  buildClinicalInstitutionalDashboardQuery
} from "@/components/clinical/clinical-institutional-dashboard";
import { requireRole } from "@/lib/auth/session";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

export default async function ClinicalInstitutionalDashboardPrintPage(props: {
  searchParams?: Promise<{
    q?: string;
    unit_id?: string;
    semester_id?: string;
    area_id?: string;
    professor_id?: string;
    student_id?: string;
    status?: string;
    print?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const searchParams = (await props.searchParams) ?? {};
  const shouldAutoPrint = searchParams.print === "1";
  const { pageData, emptyState } = await getClinicalInstitutionalDashboardPageData(
    currentUser,
    {
      query: searchParams.q ?? null,
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
    ? `/coordenador/clinica-supervisionada${backQuery}`
    : "/coordenador/clinica-supervisionada";

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        branding={reportBranding}
        title="Relatório clínico institucional"
        subtitle="Visão consolidada da unidade para acompanhamento da Clínica Supervisionada."
        backHref={backHref}
        backLabel="Voltar à gestão clínica"
        autoPrint={shouldAutoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Relatório indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível montar o relatório clínico institucional neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os dados clínicos da unidade estiverem disponíveis, o
            relatório poderá ser gerado aqui.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      branding={reportBranding}
      title="Relatório clínico institucional"
      subtitle="Consolidado institucional da Clínica Supervisionada da unidade."
      backHref={backHref}
      backLabel="Voltar à gestão clínica"
      autoPrint={shouldAutoPrint}
    >
      <ClinicalInstitutionalDashboardPrintSections pageData={pageData} />
    </ClinicalPrintDocument>
  );
}
