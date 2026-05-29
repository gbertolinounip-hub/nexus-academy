import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import {
  formatClinicalRecordStatus,
  formatClinicalScheduleLabel,
  formatDate,
  formatDateTime
} from "@/lib/utils/format";
import { getClinicalEvolutionListPageData } from "@/services/clinical-supervision";

function summarizeText(value: string, maxLength = 220) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Ainda sem descrição registrada.";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

export default async function ClinicalEvolutionIndexPage(props: {
  params: Promise<{ caseId: string }>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const { pageData, emptyState } = await getClinicalEvolutionListPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-evaluation-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Evolução</h1>
          <p>Lista diária dos registros de evolução e conduta do caso clínico.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Evolução indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar as evoluções deste caso neste contexto."
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

  return (
    <div className="stack clinical-supervision-page clinical-evaluation-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Evolução</h1>
        <p>
          {pageData.caseItem.patient.name} - {pageData.caseItem.studentName} -{" "}
          {pageData.caseItem.areaName}
        </p>
      </section>

      <SectionCard
        title="Resumo do caso"
        description="Contexto clínico e acadêmico usado para a organização diária das evoluções deste caso."
        actions={
          <div className="actions-row">
            <Link
              href={`/clinica-supervisionada/${pageData.caseItem.id}` as Route}
              className="button button-secondary button-small"
            >
              Voltar ao caso
            </Link>
            {pageData.viewerRole === "aluno" ? (
              <Link
                href={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao/nova` as Route}
                className="button button-small"
              >
                Nova evolução
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
        </div>
      </SectionCard>

      <SectionCard
        title="Evoluções registradas"
        description="Cada evolução corresponde a um atendimento diário. Avaliação e Plano de tratamento continuam únicos por caso."
      >
        {pageData.evolutions.length ? (
          <div className="clinical-evolution-list">
            {pageData.evolutions.map((evolution) => (
              <article key={evolution.id} className="clinical-evolution-list-item">
                <div className="clinical-evolution-list-header">
                  <div>
                    <h3>{formatDate(evolution.content.sessionDate)}</h3>
                    <p>
                      Atualizado em {formatDateTime(evolution.updatedAt)}
                    </p>
                  </div>
                  <strong className={`status-pill status-${evolution.status}`}>
                    {formatClinicalRecordStatus(evolution.status)}
                  </strong>
                </div>

                <div className="clinical-evolution-list-copy">
                  <p>
                    <strong>Registro:</strong>{" "}
                    {summarizeText(evolution.content.progressAndConduct)}
                  </p>
                  {evolution.supervisorFeedback?.trim() ? (
                    <p>
                      <strong>Parecer:</strong>{" "}
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
            {pageData.viewerRole === "aluno" ? (
              <Link
                href={`/clinica-supervisionada/${pageData.caseItem.id}/evolucao/nova` as Route}
                className="button button-small"
              >
                Registrar primeira evolução
              </Link>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
