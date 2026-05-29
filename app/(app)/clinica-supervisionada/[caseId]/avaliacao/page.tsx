import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalNotificationAutoRead } from "@/components/common/clinical-notification-auto-read";
import { ClinicalEvaluationContentCard } from "@/components/cards/clinical-evaluation-content";
import { ClinicalEvaluationForm } from "@/components/forms/clinical-evaluation-form";
import { ClinicalEvaluationReviewForm } from "@/components/forms/clinical-evaluation-review-form";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate
} from "@/lib/utils/format";
import { getClinicalEvaluationPageData } from "@/services/clinical-supervision";

export default async function ClinicalEvaluationPage(props: {
  params: Promise<{ caseId: string }>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const { pageData, emptyState } = await getClinicalEvaluationPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-evaluation-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Avaliação clínica</h1>
          <p>Estrutura inicial da avaliação clínica supervisionada do paciente.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Avaliação indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar esta avaliação clínica neste contexto."
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

  const evaluationStatus = pageData.evaluation?.status ?? "rascunho";
  const supervisorFeedback = pageData.evaluation?.supervisorFeedback ?? null;

  return (
    <div className="stack clinical-supervision-page clinical-evaluation-page">
      {pageData.viewerRole === "aluno" && pageData.evaluation ? (
        <ClinicalNotificationAutoRead
          enabled={pageData.evaluation.status === "aprovado"}
          caseId={pageData.caseItem.id}
          recordId={pageData.evaluation.id}
          recordType="avaliacao"
        />
      ) : null}

      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Avaliação clínica</h1>
        <p>
          {pageData.caseItem.patient.name} - {pageData.caseItem.studentName} -{" "}
          {pageData.caseItem.areaName}
        </p>
      </section>

      <SectionCard
        title="Resumo do caso"
        description="Contexto clínico e acadêmico usado para esta avaliação supervisionada."
        actions={
          <div className="actions-row">
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}` as Route}
              className="button button-secondary button-small"
            >
              Voltar ao caso
            </Link>
            <Link
              href={
                `/clinica-supervisionada/${pageData.caseItem.id}/avaliacao/impressao?print=1` as Route
              }
              className="button button-secondary button-small"
              target="_blank"
              rel="noreferrer"
            >
              Imprimir / PDF da avaliação
            </Link>
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
            <span>Status da avaliação</span>
            <strong className={`status-pill status-${evaluationStatus}`}>
              {formatClinicalRecordStatus(evaluationStatus)}
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
            title="Avaliação clínica"
            description="Preencha a avaliação inicial do caso, mantenha em rascunho ou envie para supervisão."
          >
            <ClinicalEvaluationForm
              caseId={pageData.caseItem.id}
              recordId={pageData.evaluation?.id}
              initialContent={
                pageData.evaluation?.content ?? {
                  evaluationDate: new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Sao_Paulo",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                  }).format(new Date()),
                  chiefComplaint: "",
                  currentIllnessHistory: "",
                  relevantHistory: "",
                  medicationsAndNotes: "",
                  inspectionNotes: "",
                  painNotes: "",
                  rangeOfMotion: "",
                  muscleStrength: "",
                  functionalityLimitations: "",
                  otherFindings: "",
                  clinicalDiagnosis: "",
                  initialObjectives: "",
                  finalObservations: ""
                }
              }
              currentStatus={pageData.evaluation?.status ?? null}
              canEdit={pageData.studentCanEdit}
              readOnlyMessage={pageData.studentReadOnlyMessage}
            />
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Status atual e parecer do professor sobre esta avaliação."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${evaluationStatus}`}>
                  {formatClinicalRecordStatus(evaluationStatus)}
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
            title="Conteúdo da avaliação"
            description="Visualização do conteúdo preenchido pelo aluno para este caso clínico."
          >
            {pageData.evaluation ? (
              <ClinicalEvaluationContentCard content={pageData.evaluation.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu a avaliação clínica deste caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Registre o parecer do supervisor e atualize o status da avaliação."
          >
            {pageData.evaluation ? (
              <ClinicalEvaluationReviewForm
                caseId={pageData.caseItem.id}
                recordId={pageData.evaluation.id}
                initialStatus={pageData.evaluation.status}
                initialFeedback={pageData.evaluation.supervisorFeedback}
              />
            ) : (
              <p className="empty-message">
                Assim que o aluno salvar a avaliação, o fluxo de supervisão ficará
                disponível aqui.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard
            title="Conteúdo da avaliação"
            description="Visualização institucional do conteúdo preenchido pelo aluno para este caso clínico."
          >
            {pageData.evaluation ? (
              <ClinicalEvaluationContentCard content={pageData.evaluation.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu a avaliação clínica deste caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Situação atual da supervisão desta avaliação clínica."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${evaluationStatus}`}>
                  {formatClinicalRecordStatus(evaluationStatus)}
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
