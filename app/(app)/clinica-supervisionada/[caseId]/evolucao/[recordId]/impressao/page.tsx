import { ClinicalEvolutionContentCard } from "@/components/cards/clinical-evolution-content";
import { ClinicalPrintCaseSummary } from "@/components/clinical/clinical-print-case-summary";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import { ClinicalPrintSupervisionCard } from "@/components/clinical/clinical-print-supervision-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { formatClinicalRecordStatus, formatDate, formatDateTime } from "@/lib/utils/format";
import { getClinicalEvolutionPageData } from "@/services/clinical-supervision";

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClinicalEvolutionPrintPage(props: {
  params: Promise<{ caseId: string; recordId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const autoPrint = readSearchParam(searchParams.print) === "1";
  const { pageData, emptyState } = await getClinicalEvolutionPageData(
    currentUser,
    params.caseId,
    params.recordId
  );

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        title="Evolução indisponível"
        subtitle={
          emptyState?.description ??
          "Não foi possível preparar esta versão de impressão da evolução."
        }
        backHref={`/clinica-supervisionada/${params.caseId}/evolucao`}
        backLabel="Voltar às evoluções"
        autoPrint={autoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Impressão indisponível"}
          description="Revise o vínculo do caso antes de tentar novamente."
        >
          <p className="empty-message">
            A evolução solicitada não pôde ser consolidada para impressão nesta sessão.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      title={`Evolução · ${pageData.caseItem.patient.name}`}
      subtitle="Versão organizada para impressão do registro individual de evolução e conduta."
      backHref={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao/${params.recordId}`}
      backLabel="Voltar à evolução"
      autoPrint={autoPrint}
    >
      <SectionCard
        title="Identificação do caso"
        description="Contexto clínico e acadêmico associado a este atendimento."
      >
        <ClinicalPrintCaseSummary
          caseItem={pageData.caseItem}
          statusLabel="Status da evolução"
          statusValue={
            pageData.evolution
              ? formatClinicalRecordStatus(pageData.evolution.status)
              : "Ainda não registrada"
          }
        />
      </SectionCard>

      <SectionCard
        title="Registro de Evolução e Conduta"
        description="Conteúdo completo do atendimento registrado neste caso clínico."
      >
        {pageData.evolution ? (
          <div className="clinical-record-overview-stack">
            <div className="clinical-record-overview-grid">
              <div className="report-mini-card">
                <span>Data do atendimento</span>
                <strong>{formatDate(pageData.evolution.content.sessionDate)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Última atualização</span>
                <strong>{formatDateTime(pageData.evolution.updatedAt)}</strong>
              </div>
            </div>
            <ClinicalEvolutionContentCard content={pageData.evolution.content} />
          </div>
        ) : (
          <p className="empty-message">
            A evolução solicitada ainda não foi encontrada neste caso.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Supervisão"
        description="Status atual e parecer do supervisor sobre esta evolução."
      >
        <ClinicalPrintSupervisionCard
          status={pageData.evolution?.status}
          feedback={pageData.evolution?.supervisorFeedback}
          emptyStatusLabel="Ainda não registrada"
        />
      </SectionCard>
    </ClinicalPrintDocument>
  );
}
