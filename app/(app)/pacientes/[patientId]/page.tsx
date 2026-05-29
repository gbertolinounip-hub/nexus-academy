import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalCaseStatus,
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate,
  formatDateTime
} from "@/lib/utils/format";
import { getClinicalPatientHistoryPageData } from "@/services/clinical-supervision";

export default async function ClinicalPatientHistoryPage(props: {
  params: Promise<{ patientId: string }>;
}) {
  const currentUser = await requireRole(["professor", "coordenador"]);
  const params = await props.params;
  const { pageData, emptyState } = await getClinicalPatientHistoryPageData(
    currentUser,
    params.patientId
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Base institucional de pacientes</p>
          <h1>Histórico do paciente</h1>
          <p>Visão longitudinal dos casos clínicos vinculados ao cadastro-base.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Histórico indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar o histórico institucional deste paciente."
          }
        >
          <p className="empty-message">
            Revise o vínculo institucional do paciente e tente novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Base institucional de pacientes</p>
        <h1>{pageData.patient.name}</h1>
        <p>
          Histórico longitudinal do paciente, com reaproveitamento do cadastro-base
          e preservação dos ciclos clínicos anteriores.
        </p>
      </section>

      <SectionCard
        title="Resumo do paciente"
        description="Dados cadastrais permanentes e situação clínica institucional mais recente."
        actions={
          <div className="actions-row">
            <Link href={"/pacientes" as Route} className="button button-secondary button-small">
              Voltar à base
            </Link>
            {pageData.activeCaseId ? (
              <Link
                href={`/clinica-supervisionada/${pageData.activeCaseId}` as Route}
                className="button button-secondary button-small"
              >
                Abrir caso ativo
              </Link>
            ) : pageData.latestCaseId ? (
              <Link
                href={`/clinica-supervisionada/${pageData.latestCaseId}` as Route}
                className="button button-secondary button-small"
              >
                Abrir último caso
              </Link>
            ) : null}
            <Link
              href={
                `/clinica-supervisionada/novo?patient_id=${encodeURIComponent(pageData.patient.id)}` as Route
              }
              className="button button-small"
            >
              Abrir novo caso
            </Link>
          </div>
        }
      >
        <div className="clinical-case-summary-grid">
          <div className="report-mini-card">
            <span>Paciente</span>
            <strong>{pageData.patient.name}</strong>
          </div>
          <div className="report-mini-card">
            <span>Identificador</span>
            <strong>{pageData.patient.identifier}</strong>
          </div>
          <div className="report-mini-card">
            <span>CPF</span>
            <strong>{pageData.patient.cpf?.trim() || "Não informado"}</strong>
          </div>
          <div className="report-mini-card">
            <span>Contato</span>
            <strong>{pageData.patient.contact?.trim() || "Não informado"}</strong>
          </div>
          <div className="report-mini-card">
            <span>Acompanhante</span>
            <strong>{pageData.patient.companion?.trim() || "Não informado"}</strong>
          </div>
          <div className="report-mini-card">
            <span>Data de nascimento</span>
            <strong>
              {pageData.patient.birthDate ? formatDate(pageData.patient.birthDate) : "Não informada"}
            </strong>
          </div>
          <div className="report-mini-card">
            <span>Situação atual</span>
            <strong>{pageData.patientStatusLabel}</strong>
          </div>
          <div className="report-mini-card">
            <span>Ciclos clínicos</span>
            <strong>{pageData.history.length}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Histórico do paciente"
        description="Casos clínicos anteriores e atuais vinculados a este cadastro-base, organizados do mais recente para o mais antigo."
      >
        {pageData.history.length ? (
          <div className="clinical-patient-history-stack">
            {pageData.history.map((historyItem) => (
              <article
                key={historyItem.caseItem.id}
                className="clinical-patient-history-card"
              >
                <div className="clinical-patient-history-header">
                  <div>
                    <h3>
                      {historyItem.caseItem.areaName} · {historyItem.caseItem.semesterCode}
                    </h3>
                    <p>
                      Estagiário: {historyItem.caseItem.studentName} · Supervisor:{" "}
                      {historyItem.caseItem.professorName}
                    </p>
                  </div>
                  <span className={`status-pill status-${historyItem.caseItem.status}`}>
                    {formatClinicalCaseStatus(historyItem.caseItem.status)}
                  </span>
                </div>

                <div className="clinical-patient-history-grid">
                  <div className="report-mini-card">
                    <span>Início do caso</span>
                    <strong>{formatDate(historyItem.caseItem.startedAt)}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Encerramento</span>
                    <strong>
                      {historyItem.caseItem.endedAt
                        ? formatDate(historyItem.caseItem.endedAt)
                        : "Em andamento"}
                    </strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Avaliação</span>
                    <strong>
                      {historyItem.latestEvaluationStatus
                        ? formatClinicalRecordStatus(historyItem.latestEvaluationStatus)
                        : "Ainda não registrada"}
                    </strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Plano de tratamento</span>
                    <strong>
                      {historyItem.latestTreatmentPlanStatus
                        ? formatClinicalRecordStatus(historyItem.latestTreatmentPlanStatus)
                        : "Ainda não registrado"}
                    </strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Evolução mais recente</span>
                    <strong>
                      {historyItem.latestEvolutionStatus
                        ? formatClinicalRecordStatus(historyItem.latestEvolutionStatus)
                        : "Ainda não registrada"}
                    </strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Atualização do caso</span>
                    <strong>{formatDateTime(historyItem.caseItem.updatedAt)}</strong>
                  </div>
                </div>

                <div className="clinical-record-overview-copy">
                  <p>
                    <strong>Atendimentos semanais:</strong>{" "}
                    {historyItem.caseItem.schedules
                      .map((schedule) =>
                        formatClinicalScheduleLabel(
                          schedule.weekday,
                          schedule.appointmentTime
                        )
                      )
                      .join(" · ")}
                  </p>
                </div>

                <div className="clinical-case-card-actions">
                  <Link
                    href={`/clinica-supervisionada/${historyItem.caseItem.id}` as Route}
                    className="button button-secondary button-small"
                  >
                    Abrir caso
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="clinical-evolution-empty-state">
            <p className="empty-message">
              Este cadastro-base ainda não possui histórico clínico registrado.
            </p>
            <Link
              href={
                `/clinica-supervisionada/novo?patient_id=${encodeURIComponent(pageData.patient.id)}` as Route
              }
              className="button button-small"
            >
              Abrir primeiro caso clínico
            </Link>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
