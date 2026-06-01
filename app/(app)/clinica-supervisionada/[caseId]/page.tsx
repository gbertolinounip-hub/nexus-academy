import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalNotificationFeed } from "@/components/cards/clinical-notification-feed";
import { PatientAssignmentForm } from "@/components/forms/patient-assignment-form";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalCaseStatus,
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate,
  formatDateTime
} from "@/lib/utils/format";
import {
  getClinicalCaseDetailPageData,
  getClinicalCaseFormPageData
} from "@/services/clinical-supervision";
import type {
  ClinicalEvaluationRecord,
  ClinicalEvolutionRecord,
  ClinicalTreatmentPlanRecord
} from "@/types/domain";

function summarizeText(value: string, maxLength = 180) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Ainda não informado.";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

function getEvaluationSummary(record: ClinicalEvaluationRecord) {
  return (
    record.content.chiefComplaint ||
    record.content.clinicalDiagnosis ||
    record.content.currentIllnessHistory ||
    record.content.finalObservations
  );
}

function getTreatmentPlanSummary(record: ClinicalTreatmentPlanRecord) {
  return (
    record.content.objectives ||
    record.content.conducts ||
    record.content.observations
  );
}

function getEvolutionSummary(record: ClinicalEvolutionRecord) {
  return record.content.progressAndConduct || record.content.observations;
}

export default async function ClinicalCaseDetailPage(props: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{
    secao?: string;
    notice?: string;
    notice_type?: "success" | "error";
  }>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";
  const { pageData, emptyState } = await getClinicalCaseDetailPageData(
    currentUser,
    params.caseId,
    searchParams.secao
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Caso clínico</h1>
          <p>Painel clínico integrado do caso supervisionado.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Caso indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível abrir este caso clínico neste contexto."
          }
        >
          <p className="empty-message">
            Revise o vínculo do paciente, do estagiário e da supervisão antes de
            tentar novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  const professorFormData =
    currentUser.role === "professor"
      ? await getClinicalCaseFormPageData(currentUser, { caseId: params.caseId })
      : null;
  const isStudentViewer = pageData.viewerRole === "aluno";

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>{pageData.caseItem.patient.name}</h1>
        <p>
          Painel clínico integrado do caso supervisionado em {pageData.caseItem.areaName}.
        </p>
        {notice ? (
          <p
            className={`form-notice ${
              noticeType === "success" ? "form-notice-success" : "form-notice-error"
            }`}
          >
            {notice}
          </p>
        ) : null}
      </section>

      <SectionCard
        title="Resumo do caso"
        description="Leitura clínica e acadêmica rápida do paciente, da supervisão e do andamento geral do caso."
        actions={
          <div className="actions-row">
            {!isStudentViewer ? (
              <Link
                href={`/clinica-supervisionada/${pageData.caseItem.id}/impressao?print=1` as Route}
                className="button button-secondary button-small"
                target="_blank"
                rel="noreferrer"
              >
                Imprimir / PDF do caso
              </Link>
            ) : null}
            {pageData.viewerRole === "professor" ||
            pageData.viewerRole === "coordenador" ? (
              <Link
                href={`/pacientes/${pageData.caseItem.patient.id}` as Route}
                className="button button-secondary button-small"
              >
                Histórico do paciente
              </Link>
            ) : null}
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}/avaliacao` as Route}
              className="button button-secondary button-small"
            >
              Abrir avaliação
            </Link>
            <Link
              href={
                `/clinica-supervisionada/${pageData.caseItem.id}/plano-tratamento` as Route
              }
              className="button button-secondary button-small"
            >
              Abrir plano
            </Link>
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao` as Route}
              className="button button-secondary button-small"
            >
              Abrir evoluções
            </Link>
          </div>
        }
      >
        <div className="clinical-case-summary-grid">
          <div className="report-mini-card">
            <span>Paciente</span>
            <strong className={isStudentViewer ? "clinical-sensitive-blur" : undefined}>
              {pageData.caseItem.patient.name}
            </strong>
          </div>
          <div className="report-mini-card">
            <span>Identificador</span>
            <strong>{pageData.caseItem.patient.identifier}</strong>
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
            <span>Área</span>
            <strong>{pageData.caseItem.areaName}</strong>
          </div>
          <div className="report-mini-card">
            <span>Semestre</span>
            <strong>{pageData.caseItem.semesterCode}</strong>
          </div>
          <div className="report-mini-card">
            <span>Status geral</span>
            <strong>{formatClinicalCaseStatus(pageData.caseItem.status)}</strong>
          </div>
          <div className="report-mini-card">
            <span>Início do caso</span>
            <strong>{formatDate(pageData.caseItem.startedAt)}</strong>
          </div>
          <div className="report-mini-card">
            <span>Evoluções registradas</span>
            <strong>{pageData.evolutions.length}</strong>
          </div>
          <div className="report-mini-card">
            <span>Atendimentos semanais</span>
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
          {pageData.caseItem.patient.contact ? (
            <div className="report-mini-card">
              <span>Contato</span>
              <strong className={isStudentViewer ? "clinical-sensitive-blur" : undefined}>
                {pageData.caseItem.patient.contact}
              </strong>
            </div>
          ) : null}
          {pageData.caseItem.patient.companion ? (
            <div className="report-mini-card">
              <span>Acompanhante</span>
              <strong className={isStudentViewer ? "clinical-sensitive-blur" : undefined}>
                {pageData.caseItem.patient.companion}
              </strong>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="clinical-case-integrated-grid">
        <SectionCard
          title="Avaliação"
          description="Resumo do registro inicial do caso clínico."
          actions={
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}/avaliacao` as Route}
              className="button button-secondary button-small"
            >
              Abrir avaliação
            </Link>
          }
        >
          {pageData.evaluation ? (
            <div className="clinical-record-overview-stack">
              <div className="clinical-record-overview-grid">
                <div className="report-mini-card">
                  <span>Status</span>
                  <div>
                    <span
                      className={`status-pill status-${pageData.evaluation.status}`}
                    >
                      {formatClinicalRecordStatus(pageData.evaluation.status)}
                    </span>
                  </div>
                </div>
                <div className="report-mini-card">
                  <span>Data</span>
                  <strong>{formatDate(pageData.evaluation.content.evaluationDate)}</strong>
                </div>
                <div className="report-mini-card">
                  <span>Última atualização</span>
                  <strong>{formatDateTime(pageData.evaluation.updatedAt)}</strong>
                </div>
              </div>

              <div className="clinical-record-overview-copy">
                <p>
                  <strong>Resumo clínico:</strong>{" "}
                  {summarizeText(getEvaluationSummary(pageData.evaluation))}
                </p>
                {pageData.evaluation.supervisorFeedback?.trim() ? (
                  <p>
                    <strong>Parecer do supervisor:</strong>{" "}
                    {summarizeText(pageData.evaluation.supervisorFeedback, 220)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="empty-message">
              A avaliação clínica ainda não foi iniciada neste caso.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Plano de tratamento"
          description="Resumo do plano terapêutico supervisionado do caso."
          actions={
            <Link
              href={
                `/clinica-supervisionada/${pageData.caseItem.id}/plano-tratamento` as Route
              }
              className="button button-secondary button-small"
            >
              Abrir plano
            </Link>
          }
        >
          {pageData.treatmentPlan ? (
            <div className="clinical-record-overview-stack">
              <div className="clinical-record-overview-grid">
                <div className="report-mini-card">
                  <span>Status</span>
                  <div>
                    <span
                      className={`status-pill status-${pageData.treatmentPlan.status}`}
                    >
                      {formatClinicalRecordStatus(pageData.treatmentPlan.status)}
                    </span>
                  </div>
                </div>
                <div className="report-mini-card">
                  <span>Data</span>
                  <strong>{formatDate(pageData.treatmentPlan.content.planDate)}</strong>
                </div>
                <div className="report-mini-card">
                  <span>Última atualização</span>
                  <strong>{formatDateTime(pageData.treatmentPlan.updatedAt)}</strong>
                </div>
              </div>

              <div className="clinical-record-overview-copy">
                <p>
                  <strong>Resumo terapêutico:</strong>{" "}
                  {summarizeText(getTreatmentPlanSummary(pageData.treatmentPlan))}
                </p>
                {pageData.treatmentPlan.supervisorFeedback?.trim() ? (
                  <p>
                    <strong>Parecer do supervisor:</strong>{" "}
                    {summarizeText(pageData.treatmentPlan.supervisorFeedback, 220)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="empty-message">
              O plano de tratamento ainda não foi iniciado neste caso.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Evoluções"
        description="Lista cronológica das evoluções diárias e das condutas registradas para este caso."
        actions={
          <div className="actions-row">
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao` as Route}
              className="button button-secondary button-small"
            >
              Abrir lista completa
            </Link>
            {pageData.viewerRole === "aluno" && pageData.studentCanCreateEvolution ? (
              <Link
                href={
                  `/clinica-supervisionada/${pageData.caseItem.id}/evolucao/nova` as Route
                }
                className="button button-small"
              >
                Nova evolução
              </Link>
            ) : null}
          </div>
        }
      >
        {pageData.evolutions.length ? (
          <div className="clinical-evolution-list">
            {pageData.evolutions.map((evolution) => (
              <article key={evolution.id} className="clinical-evolution-list-item">
                <div className="clinical-evolution-list-header">
                  <div>
                    <h3>{formatDate(evolution.content.sessionDate)}</h3>
                    <p>Atualizado em {formatDateTime(evolution.updatedAt)}</p>
                  </div>
                  <strong className={`status-pill status-${evolution.status}`}>
                    {formatClinicalRecordStatus(evolution.status)}
                  </strong>
                </div>

                <div className="clinical-evolution-list-copy">
                  <p>
                    <strong>Resumo do atendimento:</strong>{" "}
                    {summarizeText(getEvolutionSummary(evolution), 220)}
                  </p>
                  {evolution.supervisorFeedback?.trim() ? (
                    <p>
                      <strong>Parecer do supervisor:</strong>{" "}
                      {summarizeText(evolution.supervisorFeedback, 180)}
                    </p>
                  ) : null}
                </div>

                <div className="clinical-evolution-list-actions">
                  <Link
                    href={
                      `/clinica-supervisionada/${pageData.caseItem.id}/evolucao/${evolution.id}` as Route
                    }
                    className="button button-secondary button-small"
                  >
                    Abrir evolução
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="clinical-evolution-empty-state">
            <p className="empty-message">
              Ainda não há evoluções registradas para este caso clínico.
            </p>
            {pageData.viewerRole === "aluno" && pageData.studentCanCreateEvolution ? (
              <Link
                href={
                  `/clinica-supervisionada/${pageData.caseItem.id}/evolucao/nova` as Route
                }
                className="button button-small"
              >
                Registrar primeira evolução
              </Link>
            ) : null}
          </div>
        )}
      </SectionCard>

      <div className="clinical-case-integrated-grid">
        <SectionCard
          title="Pendências e notificações"
          description="Itens deste caso que ainda exigem ação, revisão ou ciência imediata."
          className={
            isStudentViewer
              ? "clinical-notification-highlight-card clinical-case-side-panel"
              : "clinical-notification-highlight-card"
          }
          actions={
            pageData.viewerRole === "professor" || pageData.viewerRole === "aluno" ? (
              <div className="clinical-case-header-actions">
                <Link
                  href={"/clinica-supervisionada/historico" as Route}
                  className="button button-secondary button-small"
                >
                  Histórico
                </Link>
              </div>
            ) : undefined
          }
        >
          <div className={isStudentViewer ? "clinical-case-side-panel-scroll" : undefined}>
            <ClinicalNotificationFeed
              notifications={pageData.notifications.pendingItems}
              emptyMessage="Nenhuma pendência clínica deste caso exige ação no momento."
              showReadAction={false}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Histórico clínico"
          description="Linha cronológica consolidada das movimentações clínicas e de supervisão deste caso."
          className={isStudentViewer ? "clinical-case-side-panel" : undefined}
          actions={
            pageData.viewerRole === "professor" || pageData.viewerRole === "aluno" ? (
              <Link
                href={"/clinica-supervisionada/historico" as Route}
                className="button button-secondary button-small"
              >
                Histórico completo
              </Link>
            ) : undefined
          }
        >
          <div className={isStudentViewer ? "clinical-case-side-panel-scroll" : undefined}>
            <ClinicalNotificationFeed
              notifications={pageData.notifications.historyItems}
              emptyMessage="Ainda não há eventos clínicos registrados para este caso."
              showReadAction
            />
          </div>
        </SectionCard>
      </div>

      {currentUser.role === "professor" && professorFormData?.formData ? (
        <SectionCard
          title="Dados operacionais do caso"
          description="Edite o cadastro-base do paciente e os dados operacionais do caso sem sair do painel clínico integrado."
        >
          <PatientAssignmentForm
            mode="edit"
            studentOptions={professorFormData.formData.studentOptions}
            emptyHint={professorFormData.formData.emptyHint}
            initialValues={{
              case_id: professorFormData.formData.initialValues.caseId ?? "",
              patient_id: professorFormData.formData.initialValues.patientId,
              patient_identifier: professorFormData.formData.initialValues.patientIdentifier,
              patient_name: professorFormData.formData.initialValues.patientName,
              patient_birth_date: professorFormData.formData.initialValues.patientBirthDate,
              patient_cpf: professorFormData.formData.initialValues.patientCpf,
              patient_contact: professorFormData.formData.initialValues.patientContact,
              patient_companion: professorFormData.formData.initialValues.patientCompanion,
              enrollment_id: professorFormData.formData.initialValues.enrollmentId,
              schedules: professorFormData.formData.initialValues.schedules,
              status: professorFormData.formData.initialValues.status
            }}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
