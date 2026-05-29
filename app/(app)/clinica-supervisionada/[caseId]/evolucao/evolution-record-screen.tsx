import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalNotificationAutoRead } from "@/components/common/clinical-notification-auto-read";
import { ClinicalEvolutionContentCard } from "@/components/cards/clinical-evolution-content";
import { ClinicalEvolutionForm } from "@/components/forms/clinical-evolution-form";
import { ClinicalEvolutionReviewForm } from "@/components/forms/clinical-evolution-review-form";
import {
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate
} from "@/lib/utils/format";
import type { ClinicalEvolutionPageData } from "@/services/clinical-supervision";

interface ClinicalEvolutionRecordScreenProps {
  pageData: ClinicalEvolutionPageData;
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function ClinicalEvolutionRecordScreen({
  pageData
}: ClinicalEvolutionRecordScreenProps) {
  const evolutionStatus = pageData.evolution?.status ?? "rascunho";
  const supervisorFeedback = pageData.evolution?.supervisorFeedback ?? null;

  return (
    <div className="stack clinical-supervision-page clinical-evaluation-page">
      {pageData.viewerRole === "aluno" && pageData.evolution ? (
        <ClinicalNotificationAutoRead
          enabled={pageData.evolution.status === "aprovado"}
          caseId={pageData.caseItem.id}
          recordId={pageData.evolution.id}
          recordType="evolucao"
        />
      ) : null}

      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Registro de Evolução e Conduta</h1>
        <p>
          {pageData.caseItem.patient.name} - {pageData.caseItem.studentName} -{" "}
          {pageData.caseItem.areaName}
        </p>
      </section>

      <SectionCard
        title="Resumo do caso"
        description="Contexto clínico e acadêmico usado para este registro evolutivo supervisionado."
        actions={
          <div className="actions-row">
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao` as Route}
              className="button button-secondary button-small"
            >
              Voltar à lista
            </Link>
            {pageData.evolution ? (
              <Link
                href={
                  `/clinica-supervisionada/${pageData.caseItem.id}/evolucao/${pageData.evolution.id}/impressao?print=1` as Route
                }
                className="button button-secondary button-small"
                target="_blank"
                rel="noreferrer"
              >
                Imprimir / PDF da evolução
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
            <span>Status da evolução</span>
            <strong className={`status-pill status-${evolutionStatus}`}>
              {formatClinicalRecordStatus(evolutionStatus)}
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
            title="Registro de Evolução e Conduta"
            description="Descreva a condição diária do paciente e a conduta terapêutica realizada. Você pode salvar em rascunho ou enviar para supervisão."
          >
            <ClinicalEvolutionForm
              caseId={pageData.caseItem.id}
              recordId={pageData.evolution?.id}
              initialContent={
                pageData.evolution?.content ?? {
                  sessionDate: getTodayInSaoPaulo(),
                  progressAndConduct: "",
                  observations: ""
                }
              }
              currentStatus={pageData.evolution?.status ?? null}
              canEdit={pageData.studentCanEdit}
              readOnlyMessage={pageData.studentReadOnlyMessage}
            />
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Status atual e parecer do professor sobre este registro evolutivo."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${evolutionStatus}`}>
                  {formatClinicalRecordStatus(evolutionStatus)}
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
            title="Conteúdo da evolução"
            description="Visualização do conteúdo preenchido pelo aluno para este registro de evolução e conduta."
          >
            {pageData.evolution ? (
              <ClinicalEvolutionContentCard content={pageData.evolution.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu o Registro de Evolução e Conduta deste
                caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Registre o parecer do supervisor e atualize o status da evolução."
          >
            {pageData.evolution ? (
              <ClinicalEvolutionReviewForm
                caseId={pageData.caseItem.id}
                recordId={pageData.evolution.id}
                initialStatus={pageData.evolution.status}
                initialFeedback={pageData.evolution.supervisorFeedback}
              />
            ) : (
              <p className="empty-message">
                Assim que o aluno salvar o Registro de Evolução e Conduta, o fluxo
                de supervisão ficará disponível aqui.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard
            title="Conteúdo da evolução"
            description="Visualização institucional do conteúdo preenchido pelo aluno para este registro de evolução e conduta."
          >
            {pageData.evolution ? (
              <ClinicalEvolutionContentCard content={pageData.evolution.content} />
            ) : (
              <p className="empty-message">
                O aluno ainda não preencheu o Registro de Evolução e Conduta deste caso.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Supervisão"
            description="Situação atual da supervisão deste registro evolutivo."
          >
            <div className="clinical-evaluation-feedback-card">
              <div className="clinical-evaluation-feedback-row">
                <span>Status</span>
                <strong className={`status-pill status-${evolutionStatus}`}>
                  {formatClinicalRecordStatus(evolutionStatus)}
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
