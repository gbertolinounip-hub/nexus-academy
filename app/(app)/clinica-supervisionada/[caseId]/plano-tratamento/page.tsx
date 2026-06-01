import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalNotificationAutoRead } from "@/components/common/clinical-notification-auto-read";
import { ClinicalTreatmentPlanContentCard } from "@/components/cards/clinical-treatment-plan-content";
import { ClinicalTreatmentPlanForm } from "@/components/forms/clinical-treatment-plan-form";
import { ClinicalTreatmentPlanReviewForm } from "@/components/forms/clinical-treatment-plan-review-form";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate
} from "@/lib/utils/format";
import { getClinicalTreatmentPlanPageData } from "@/services/clinical-supervision";

export default async function ClinicalTreatmentPlanPage(props: {
  params: Promise<{ caseId: string }>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const { pageData, emptyState } = await getClinicalTreatmentPlanPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-evaluation-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Plano de tratamento</h1>
          <p>Estrutura inicial do plano terapêutico supervisionado do paciente.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Plano de tratamento indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar este Plano de tratamento neste contexto."
          }
        >
          <p className="empty-message">
            Revise o vínculo do caso, do estagiário e da supervisão antes de tentar
            novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  const treatmentPlanStatus = pageData.treatmentPlan?.status ?? "rascunho";
  const supervisorFeedback = pageData.treatmentPlan?.supervisorFeedback ?? null;

  return (
    <div className="stack clinical-supervision-page clinical-evaluation-page">
      {pageData.viewerRole === "aluno" && pageData.treatmentPlan ? (
        <ClinicalNotificationAutoRead
          enabled={pageData.treatmentPlan.status === "aprovado"}
          caseId={pageData.caseItem.id}
          recordId={pageData.treatmentPlan.id}
          recordType="plano_tratamento"
        />
      ) : null}

      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Plano de tratamento</h1>
        <p>
          {pageData.caseItem.patient.name} - {pageData.caseItem.studentName} -{" "}
          {pageData.caseItem.areaName}
        </p>
      </section>

      <SectionCard
        title="Resumo do caso"
        description="Contexto clínico e acadêmico usado para este Plano de tratamento supervisionado."
        actions={
          <div className="actions-row">
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}` as Route}
              className="button button-secondary button-small"
            >
              Voltar ao caso
            </Link>
            {pageData.viewerRole !== "aluno" ? (
              <Link
                href={
                  `/clinica-supervisionada/${pageData.caseItem.id}/plano-tratamento/impressao?print=1` as Route
                }
                className="button button-secondary button-small"
                target="_blank"
                rel="noreferrer"
              >
                Imprimir / PDF do plano
              </Link>
            ) : null}
          </div>
        }
      >
        <div className="clinical-case-summary-grid">
          <div className="report-mini-card">
            <span>Paciente</span>
            <strong>{pageData.caseItem.patient.name}</strong>
          </div>
          <div className="report-mini-card">
            <span>Estagiário</span>
            <strong>{pageData.caseItem.studentName}</strong>
          </div>
          <div className="report-mini-card">
            <span>Supervisor</span>
            <strong>{pageData.caseItem.professorName}</strong>
          </div>
          <div className="report-mini-card">
            <span>Semestre</span>
            <strong>{pageData.caseItem.semesterCode}</strong>
          </div>
          <div className="report-mini-card">
            <span>Status do plano</span>
            <strong className={`status-pill status-${treatmentPlanStatus}`}>
              {formatClinicalRecordStatus(treatmentPlanStatus)}
            </strong>
          </div>
          <div className="report-mini-card">
            <span>Atendimentos</span>
            <strong className="clinical-case-summary-schedule-list">
              {pageData.caseItem.schedules.map((schedule) => (
                <span key={schedule.id}>
                  {formatClinicalScheduleLabel(
                    schedule.weekday,
                    schedule.appointmentTime
                  )}
                </span>
              ))}
            </strong>
          </div>
          <div className="report-mini-card">
            <span>Início do caso</span>
            <strong>{formatDate(pageData.caseItem.startedAt)}</strong>
          </div>
          <div className="report-mini-card">
            <span>Identificador</span>
            <strong>{pageData.caseItem.patient.identifier}</strong>
          </div>
        </div>
      </SectionCard>

      {pageData.viewerRole === "aluno" ? (
        <>
          <SectionCard
            title="Plano de tratamento"
            description="Apresente seus objetivos e as condutas para cada objetivo. Você pode salvar em rascunho ou enviar para supervisão."
          >
            <ClinicalTreatmentPlanForm
              caseId={pageData.caseItem.id}
              recordId={pageData.treatmentPlan?.id}
              initialContent={
                pageData.treatmentPlan?.content ?? {
                  planDate: new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Sao_Paulo",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                  }).format(new Date()),
                  objectives: "",
                  conducts: "",
                  observations: ""
                }
              }
              currentStatus={pageData.treatmentPlan?.status ?? null}
              canEdit={pageData.studentCanEdit}
              readOnlyMessage={pageData.studentReadOnlyMessage}
            />
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Status atual e parecer do professor sobre este Plano de tratamento."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${treatmentPlanStatus}`}>
                  {formatClinicalRecordStatus(treatmentPlanStatus)}
                </strong>
              </div>
              <div className="clinical-evaluation-feedback-block">
                <span>Parecer do supervisor</span>
                <p>{supervisorFeedback?.trim() ? supervisorFeedback : "Ainda sem parecer."}</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : pageData.viewerRole === "professor" ? (
        <>
          <SectionCard
            title="Conteúdo do plano"
            description="Visualização do conteúdo preenchido pelo aluno para este plano terapêutico supervisionado."
          >
            {pageData.treatmentPlan ? (
              <ClinicalTreatmentPlanContentCard content={pageData.treatmentPlan.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu o Plano de tratamento deste caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Registre o parecer do supervisor e atualize o status do Plano de tratamento."
          >
            {pageData.treatmentPlan ? (
              <ClinicalTreatmentPlanReviewForm
                caseId={pageData.caseItem.id}
                recordId={pageData.treatmentPlan.id}
                initialStatus={pageData.treatmentPlan.status}
                initialFeedback={pageData.treatmentPlan.supervisorFeedback}
              />
            ) : (
              <p className="empty-message">
                Assim que o aluno salvar o Plano de tratamento, o fluxo de
                supervisão ficará disponível aqui.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard
            title="Conteúdo do plano"
            description="Visualização institucional do conteúdo preenchido pelo aluno para este plano terapêutico supervisionado."
          >
            {pageData.treatmentPlan ? (
              <ClinicalTreatmentPlanContentCard content={pageData.treatmentPlan.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu o Plano de tratamento deste caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Situação atual da supervisão deste Plano de tratamento."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${treatmentPlanStatus}`}>
                  {formatClinicalRecordStatus(treatmentPlanStatus)}
                </strong>
              </div>
              <div className="clinical-evaluation-feedback-block">
                <span>Parecer do supervisor</span>
                <p>{supervisorFeedback?.trim() ? supervisorFeedback : "Ainda sem parecer."}</p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
