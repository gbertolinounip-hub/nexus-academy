import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalDailyAttendanceTable } from "@/components/tables/clinical-daily-attendance-table";
import { ClinicalPendingEvolutionTable } from "@/components/tables/clinical-pending-evolution-table";
import { requireRole } from "@/lib/auth/session";
import {
  formatDate,
  formatClinicalWeekday,
  getClinicalWeekdayFromDateOnly
} from "@/lib/utils/format";
import { getClinicalDailyAttendancePageData } from "@/services/clinical-supervision";

function buildAttendancePageHref(input: {
  date: string;
  areaId: string;
  professorId: string;
  status: string;
  pendingAreaId: string;
  pendingStudentId: string;
  pendingStatus: string;
}) {
  const searchParams = new URLSearchParams();

  if (input.date) {
    searchParams.set("date", input.date);
  }

  if (input.areaId) {
    searchParams.set("areaId", input.areaId);
  }

  if (input.professorId) {
    searchParams.set("professorId", input.professorId);
  }

  if (input.status && input.status !== "todos") {
    searchParams.set("status", input.status);
  }

  if (input.pendingAreaId) {
    searchParams.set("pendingAreaId", input.pendingAreaId);
  }

  if (input.pendingStudentId) {
    searchParams.set("pendingStudentId", input.pendingStudentId);
  }

  if (input.pendingStatus && input.pendingStatus !== "todos") {
    searchParams.set("pendingStatus", input.pendingStatus);
  }

  const query = searchParams.toString();
  return (`/clinica-supervisionada/atendimentos${query ? `?${query}` : ""}`) as Route;
}

export default async function ClinicalDailyAttendancePage(props: {
  searchParams?: Promise<{
    date?: string;
    areaId?: string;
    professorId?: string;
    status?: string;
    pendingAreaId?: string;
    pendingStudentId?: string;
    pendingStatus?: string;
  }>;
}) {
  const currentUser = await requireRole(["professor", "secretaria"]);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalDailyAttendancePageData(
    currentUser,
    {
      date: searchParams.date ?? null,
      areaId: searchParams.areaId ?? null,
      professorId: searchParams.professorId ?? null,
      status: searchParams.status ?? null,
      pendingAreaId: searchParams.pendingAreaId ?? null,
      pendingStudentId: searchParams.pendingStudentId ?? null,
      pendingStatus: searchParams.pendingStatus ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-attendance-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Controle diário de atendimentos</h1>
          <p>Separação entre agenda operacional do dia e pendências clínicas em aberto.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Atendimentos indisponíveis"}
          description={
            emptyState?.description ??
            "Não foi possível montar a agenda diária de atendimentos neste contexto."
          }
        >
          <p className="empty-message">
            Revise o escopo operacional da unidade e tente novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  const clearDayFiltersHref = buildAttendancePageHref({
    date: pageData.selectedDate,
    areaId: "",
    professorId: "",
    status: "todos",
    pendingAreaId: pageData.pendingFilters.areaId,
    pendingStudentId: pageData.pendingFilters.studentId,
    pendingStatus: pageData.pendingFilters.status
  });

  const clearPendingFiltersHref = buildAttendancePageHref({
    date: pageData.selectedDate,
    areaId: pageData.filters.areaId,
    professorId: pageData.filters.professorId,
    status: pageData.filters.status,
    pendingAreaId: "",
    pendingStudentId: "",
    pendingStatus: "todos"
  });
  const selectedWeekdayLabel = formatClinicalWeekday(
    getClinicalWeekdayFromDateOnly(pageData.selectedDate) ?? "segunda"
  );
  const pendingViewerRole = currentUser.role === "secretaria" ? "secretaria" : "professor";

  return (
    <div className="stack clinical-supervision-page clinical-attendance-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Controle diário de atendimentos</h1>
        <p>
          {currentUser.role === "professor"
            ? "Registre a ocorrência real do atendimento na data selecionada e acompanhe, em separado, as evoluções ainda abertas dos seus alunos."
            : "Organize a agenda operacional do dia sem perder de vista as pendências clínicas já abertas na unidade."}
        </p>
      </section>

      <SectionCard
        title="Atendimentos do dia"
        description={`Pacientes previstos para ${formatDate(pageData.selectedDate)} (${selectedWeekdayLabel}).`}
        actions={
          <Link
            href={"/clinica-supervisionada" as Route}
            className="button button-secondary button-small"
          >
            Voltar à Clínica
          </Link>
        }
      >
        <div className="metrics-grid">
          <MetricCard
            label="Previstos na data"
            value={String(pageData.metrics.scheduledCount)}
            hint={`Agenda clínica prevista para ${formatDate(pageData.selectedDate)}.`}
          />
          <MetricCard
            label="Pacientes presentes"
            value={String(pageData.metrics.presentCount)}
            hint="Atendimentos marcados como paciente presente."
            tone="positive"
          />
          <MetricCard
            label="Pacientes ausentes"
            value={String(pageData.metrics.absentCount)}
            hint="Atendimentos dispensados por ausência do paciente."
          />
          <MetricCard
            label="Pendências geradas hoje"
            value={String(pageData.metrics.pendingCount)}
            hint="Atendimentos da data filtrada que já exigem evolução do aluno."
          />
        </div>

        <form method="get" className="form-grid clinical-attendance-filter-grid">
          <input type="hidden" name="pendingAreaId" value={pageData.pendingFilters.areaId} />
          <input
            type="hidden"
            name="pendingStudentId"
            value={pageData.pendingFilters.studentId}
          />
          <input type="hidden" name="pendingStatus" value={pageData.pendingFilters.status} />

          <label className="field">
            <span>Data</span>
            <input
              className="input"
              type="date"
              name="date"
              defaultValue={pageData.selectedDate}
            />
          </label>

          <label className="field">
            <span>Área de estágio</span>
            <select className="input" name="areaId" defaultValue={pageData.filters.areaId}>
              <option value="">Todas</option>
              {pageData.filterOptions.areas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {currentUser.role === "secretaria" ? (
            <label className="field">
              <span>Professor</span>
              <select
                className="input"
                name="professorId"
                defaultValue={pageData.filters.professorId}
              >
                <option value="">Todos</option>
                {pageData.filterOptions.professors.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>Status do paciente</span>
            <select className="input" name="status" defaultValue={pageData.filters.status}>
              {pageData.filterOptions.statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="clinical-attendance-filter-actions">
            <button type="submit" className="button button-small">
              Filtrar atendimentos
            </button>
            <Link href={clearDayFiltersHref} className="button button-secondary button-small">
              Limpar filtros do dia
            </Link>
          </div>
        </form>

        <ClinicalDailyAttendanceTable items={pageData.items} />
      </SectionCard>

      <SectionCard
        title="Pendências de evolução"
        description="Evoluções abertas de atendimentos anteriores ou do dia atual. Esta lista não depende da data filtrada na agenda do dia."
      >
        <div className="metrics-grid">
          <MetricCard
            label="Pendências abertas"
            value={String(pageData.pendingMetrics.totalOpenCount)}
            hint="Total de atendimentos presentes ainda em tramitação clínica."
          />
          <MetricCard
            label="Pendentes"
            value={String(pageData.pendingMetrics.pendingCount)}
            hint="Aguardando o registro inicial da evolução."
          />
          <MetricCard
            label="Enviadas para revisão"
            value={String(pageData.pendingMetrics.sentCount)}
            hint="Evoluções enviadas pelo aluno e ainda sem parecer final."
          />
          <MetricCard
            label="Ajustes solicitados"
            value={String(pageData.pendingMetrics.adjustmentCount)}
            hint="Evoluções devolvidas pela supervisão para correção."
          />
        </div>

        <form method="get" className="form-grid clinical-attendance-filter-grid">
          <input type="hidden" name="date" value={pageData.selectedDate} />
          <input type="hidden" name="areaId" value={pageData.filters.areaId} />
          <input type="hidden" name="professorId" value={pageData.filters.professorId} />
          <input type="hidden" name="status" value={pageData.filters.status} />

          <label className="field">
            <span>Área de estágio</span>
            <select
              className="input"
              name="pendingAreaId"
              defaultValue={pageData.pendingFilters.areaId}
            >
              <option value="">Todas</option>
              {pageData.pendingFilterOptions.areas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Aluno</span>
            <select
              className="input"
              name="pendingStudentId"
              defaultValue={pageData.pendingFilters.studentId}
            >
              <option value="">Todos</option>
              {pageData.pendingFilterOptions.students.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status da evolução</span>
            <select
              className="input"
              name="pendingStatus"
              defaultValue={pageData.pendingFilters.status}
            >
              {pageData.pendingFilterOptions.statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="clinical-attendance-filter-actions">
            <button type="submit" className="button button-small">
              Filtrar pendências
            </button>
            <Link
              href={clearPendingFiltersHref}
              className="button button-secondary button-small"
            >
              Limpar filtros de pendência
            </Link>
          </div>
        </form>

        <ClinicalPendingEvolutionTable
          items={pageData.pendingItems}
          viewerRole={pendingViewerRole}
          emptyMessage={
            currentUser.role === "professor"
              ? "Nenhuma pendência clínica em aberto foi encontrada para os seus atendimentos."
              : "Nenhuma pendência clínica em aberto foi encontrada no escopo operacional desta unidade."
          }
        />
      </SectionCard>
    </div>
  );
}
