import { ClinicalEvolutionContentCard } from "@/components/cards/clinical-evolution-content";
import { ClinicalEvaluationContentCard } from "@/components/cards/clinical-evaluation-content";
import { ClinicalNotificationFeed } from "@/components/cards/clinical-notification-feed";
import { ClinicalTreatmentPlanContentCard } from "@/components/cards/clinical-treatment-plan-content";
import { ClinicalPrintCaseSummary } from "@/components/clinical/clinical-print-case-summary";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import { ClinicalPrintSupervisionCard } from "@/components/clinical/clinical-print-supervision-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalCaseStatus,
  formatClinicalRecordStatus,
  formatDate,
  formatDateTime
} from "@/lib/utils/format";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getClinicalCaseDetailPageData } from "@/services/clinical-supervision";

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClinicalCasePrintPage(props: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const autoPrint = readSearchParam(searchParams.print) === "1";
  const { pageData, emptyState } = await getClinicalCaseDetailPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        branding={reportBranding}
        title="Caso clínico indisponível"
        subtitle={
          emptyState?.description ??
          "Não foi possível preparar esta versão de impressão do caso clínico."
        }
        backHref={`/clinica-supervisionada/${params.caseId}`}
        backLabel="Voltar ao caso"
        autoPrint={autoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Impressão indisponível"}
          description="Revise o vínculo do caso antes de tentar novamente."
        >
          <p className="empty-message">
            O conteúdo clínico não pôde ser consolidado para impressão nesta sessão.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      branding={reportBranding}
      title={`Caso clínico · ${pageData.caseItem.patient.name}`}
      subtitle="Documento integrado com resumo do caso, registros clínicos e movimentações relevantes."
      backHref={`/clinica-supervisionada/${pageData.caseItem.id}`}
      backLabel="Voltar ao caso"
      autoPrint={autoPrint}
    >
      <SectionCard
        title="Identificação do caso"
        description="Contexto clínico e acadêmico consolidado para impressão."
      >
        <ClinicalPrintCaseSummary
          caseItem={pageData.caseItem}
          statusLabel="Status geral do caso"
          statusValue={formatClinicalCaseStatus(pageData.caseItem.status)}
        />
      </SectionCard>

      <SectionCard
        title="Avaliação"
        description="Registro clínico inicial do caso."
      >
        {pageData.evaluation ? (
          <div className="clinical-record-overview-stack">
            <div className="clinical-record-overview-grid">
              <div className="report-mini-card">
                <span>Status</span>
                <strong>{formatClinicalRecordStatus(pageData.evaluation.status)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Data da avaliação</span>
                <strong>{formatDate(pageData.evaluation.content.evaluationDate)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Última atualização</span>
                <strong>{formatDateTime(pageData.evaluation.updatedAt)}</strong>
              </div>
            </div>
            <ClinicalEvaluationContentCard content={pageData.evaluation.content} />
            <ClinicalPrintSupervisionCard
              status={pageData.evaluation.status}
              feedback={pageData.evaluation.supervisorFeedback}
            />
          </div>
        ) : (
          <p className="empty-message">
            A avaliação clínica ainda não foi registrada neste caso.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Plano de tratamento"
        description="Objetivos e condutas terapêuticas do caso."
      >
        {pageData.treatmentPlan ? (
          <div className="clinical-record-overview-stack">
            <div className="clinical-record-overview-grid">
              <div className="report-mini-card">
                <span>Status</span>
                <strong>
                  {formatClinicalRecordStatus(pageData.treatmentPlan.status)}
                </strong>
              </div>
              <div className="report-mini-card">
                <span>Data do plano</span>
                <strong>{formatDate(pageData.treatmentPlan.content.planDate)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Última atualização</span>
                <strong>{formatDateTime(pageData.treatmentPlan.updatedAt)}</strong>
              </div>
            </div>
            <ClinicalTreatmentPlanContentCard content={pageData.treatmentPlan.content} />
            <ClinicalPrintSupervisionCard
              status={pageData.treatmentPlan.status}
              feedback={pageData.treatmentPlan.supervisorFeedback}
            />
          </div>
        ) : (
          <p className="empty-message">
            O plano de tratamento ainda não foi registrado neste caso.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Evoluções"
        description="Registros diários de evolução e conduta já documentados neste caso."
      >
        {pageData.evolutions.length ? (
          <div className="clinical-print-record-stack">
            {pageData.evolutions.map((evolution) => (
              <article key={evolution.id} className="clinical-print-record-card">
                <div className="clinical-evolution-list-header">
                  <div>
                    <h3>{formatDate(evolution.content.sessionDate)}</h3>
                    <p>Atualizado em {formatDateTime(evolution.updatedAt)}</p>
                  </div>
                  <strong>{formatClinicalRecordStatus(evolution.status)}</strong>
                </div>
                <ClinicalEvolutionContentCard content={evolution.content} />
                <ClinicalPrintSupervisionCard
                  status={evolution.status}
                  feedback={evolution.supervisorFeedback}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Ainda não há evoluções registradas para este caso clínico.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Pendências e notificações"
        description="Itens clínicos deste caso que ainda exigem ação ou ciência imediata."
      >
        <ClinicalNotificationFeed
          notifications={pageData.notifications.pendingItems}
          emptyMessage="Nenhuma pendência clínica deste caso exige ação no momento."
          showReadAction={false}
          showOpenAction={false}
        />
      </SectionCard>

      <SectionCard
        title="Histórico clínico"
        description="Linha cronológica das movimentações clínicas e de supervisão registradas neste caso."
      >
        <ClinicalNotificationFeed
          notifications={pageData.notifications.historyItems}
          emptyMessage="Ainda não há eventos clínicos registrados para este caso."
          showReadAction={false}
          showOpenAction={false}
        />
      </SectionCard>
    </ClinicalPrintDocument>
  );
}
