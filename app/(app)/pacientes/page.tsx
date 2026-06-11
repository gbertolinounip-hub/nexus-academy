import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { formatClinicalCaseStatus, formatDateTime } from "@/lib/utils/format";
import { getClinicalPatientBasePageData } from "@/services/clinical-supervision";

function getStatusClassName(status: string) {
  switch (status) {
    case "com_caso_ativo":
      return "status-ativo";
    case "alta":
      return "status-alta";
    default:
      return "status-encerrado";
  }
}

export default async function ClinicalPatientsBasePage(props: {
  searchParams?: Promise<{
    q?: string;
    unit_id?: string;
    status?: string;
    semester_id?: string;
    area_id?: string;
  }>;
}) {
  const currentUser = await requireRole(["professor", "coordenador", "secretaria"]);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalPatientBasePageData(currentUser, {
    query: searchParams.q ?? null,
    unitId: searchParams.unit_id ?? null,
    status: searchParams.status ?? null,
    semesterId: searchParams.semester_id ?? null,
    areaId: searchParams.area_id ?? null
  });

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Base institucional de pacientes</p>
          <h1>Pacientes</h1>
          <p>
            Cadastro permanente de pacientes da Clínica Supervisionada, com
            reaproveitamento entre ciclos da unidade.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Base indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar a base institucional de pacientes neste contexto."
          }
        >
          <p className="empty-message">
            Assim que a base clínica estiver disponível para o seu perfil, os
            pacientes permanentes da unidade aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  const isSecretaryView = pageData.viewerRole === "secretaria";
  const showUnitFilter = pageData.filterOptions.units.length > 0;
  const showSearchFilter = !showUnitFilter;

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Base institucional de pacientes</p>
        <h1>Pacientes</h1>
        <p>
          {pageData.viewerRole === "coordenador"
            ? showUnitFilter
              ? "Consulte a base permanente de pacientes do curso, acompanhe o histórico longitudinal por unidade e abra novos casos clínicos sem recadastro desnecessário."
              : "Consulte a base permanente de pacientes da unidade, acompanhe o histórico longitudinal e abra novos casos clínicos sem recadastro desnecessário."
            : isSecretaryView
              ? "Consulte a base administrativa de pacientes da unidade, com busca, filtros e visão operacional para cadastro e atribuição."
              : "Consulte os pacientes vinculados à sua atuação clínica, acompanhe o histórico longitudinal e reutilize o cadastro-base para novos casos."}
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Pacientes visíveis"
          value={String(pageData.metrics.totalPatients)}
          hint="Cadastros-base acessíveis no seu contexto institucional atual."
        />
        <MetricCard
          label="Com caso ativo"
          value={String(pageData.metrics.activePatients)}
          hint="Pacientes que ainda possuem acompanhamento clínico em andamento."
          tone="positive"
        />
        <MetricCard
          label={isSecretaryView ? "Cadastros com histórico" : "Com histórico"}
          value={String(pageData.metrics.patientsWithHistory)}
          hint={
            isSecretaryView
              ? "Pacientes que já tiveram ao menos um caso registrado na base institucional."
              : "Pacientes com pelo menos um caso clínico registrado na base institucional."
          }
        />
      </div>

      <SectionCard
        title="Busca e filtros"
        description={
          showSearchFilter
            ? "Pesquise por nome, identificador ou CPF e refine a base institucional por status, semestre e área."
            : "Refine a base institucional do curso por unidade, status, semestre e área."
        }
      >
        <form method="get" className="clinical-patient-filter-grid">
          {showSearchFilter ? (
            <label className="field">
              <span>Busca</span>
              <input
                className="input"
                type="search"
                name="q"
                defaultValue={pageData.filters.query}
                placeholder="Nome, identificador ou CPF"
              />
            </label>
          ) : null}

          {showUnitFilter ? (
            <label className="field">
              <span>Unidade</span>
              <select
                className="input"
                name="unit_id"
                defaultValue={pageData.filters.unitId}
              >
                <option value="">Todas</option>
                {pageData.filterOptions.units.map((unitOption) => (
                  <option key={unitOption.id} value={unitOption.id}>
                    {unitOption.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>Status</span>
            <select
              className="input"
              name="status"
              defaultValue={pageData.filters.status}
            >
              <option value="todos">Todos</option>
              <option value="com_caso_ativo">Com caso ativo</option>
              <option value="alta">Alta</option>
              <option value="com_historico">Com histórico</option>
            </select>
          </label>

          <label className="field">
            <span>Semestre</span>
            <select
              className="input"
              name="semester_id"
              defaultValue={pageData.filters.semesterId}
            >
              <option value="">Todos</option>
              {pageData.filterOptions.semesters.map((semesterOption) => (
                <option key={semesterOption.id} value={semesterOption.id}>
                  {semesterOption.code}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Área</span>
            <select
              className="input"
              name="area_id"
              defaultValue={pageData.filters.areaId}
            >
              <option value="">Todas</option>
              {pageData.filterOptions.areas.map((areaOption) => (
                <option key={areaOption.id} value={areaOption.id}>
                  {areaOption.name}
                </option>
              ))}
            </select>
          </label>

          <div className="actions-row clinical-patient-filter-actions">
            <button type="submit" className="button button-small">
              Aplicar filtros
            </button>
            <Link href={"/pacientes" as Route} className="button button-secondary button-small">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Base institucional"
        description="Cadastros permanentes de pacientes reutilizáveis para novos ciclos, sem perder o histórico anterior."
      >
        {pageData.patients.length ? (
          <div className="clinical-patient-base-grid">
            {pageData.patients.map((patientItem) => (
              <article key={patientItem.patient.id} className="clinical-patient-base-card">
                <div className="clinical-patient-base-header">
                  <div>
                    <h3>{patientItem.patient.name}</h3>
                    <p>{patientItem.patient.identifier}</p>
                  </div>
                  <span
                    className={`status-pill ${getStatusClassName(patientItem.currentStatus)}`}
                  >
                    {patientItem.currentStatusLabel}
                  </span>
                </div>

                <div className="clinical-patient-base-body">
                  <p className="clinical-case-card-copy">
                    Contato: {patientItem.patient.contact?.trim() || "Não informado"}
                  </p>
                  <p className="clinical-case-card-copy">
                    Último semestre: {patientItem.latestSemesterCode ?? "Ainda sem caso"}
                  </p>
                  <p className="clinical-case-card-copy">
                    Status do último caso:{" "}
                    {patientItem.latestCaseStatus
                      ? formatClinicalCaseStatus(patientItem.latestCaseStatus)
                      : "Ainda sem caso"}
                  </p>
                  <p className="clinical-case-card-copy">
                    Última área: {patientItem.latestAreaName ?? "Ainda sem caso"}
                  </p>
                  <p className="clinical-case-card-copy">
                    Último supervisor: {patientItem.latestProfessorName ?? "Ainda sem caso"}
                  </p>
                  <p className="clinical-case-card-copy">
                    Estagiário mais recente: {patientItem.latestStudentName ?? "Ainda sem caso"}
                  </p>
                  {!isSecretaryView ? (
                    <p className="clinical-case-card-copy">
                      Histórico de casos: {patientItem.historyCount}
                    </p>
                  ) : null}
                  {!isSecretaryView && patientItem.lastUpdatedAt ? (
                    <p className="clinical-case-card-copy">
                      Última atualização clínica: {formatDateTime(patientItem.lastUpdatedAt)}
                    </p>
                  ) : null}
                </div>

                {!isSecretaryView ? (
                  <div className="clinical-case-card-actions">
                    <Link
                      href={`/pacientes/${patientItem.patient.id}` as Route}
                      className="button button-secondary button-small"
                    >
                      Abrir histórico
                    </Link>
                    {patientItem.activeCaseId ? (
                      <Link
                        href={`/clinica-supervisionada/${patientItem.activeCaseId}` as Route}
                        className="button button-secondary button-small"
                      >
                        Abrir caso ativo
                      </Link>
                    ) : patientItem.latestCaseId ? (
                      <Link
                        href={`/clinica-supervisionada/${patientItem.latestCaseId}` as Route}
                        className="button button-secondary button-small"
                      >
                        Abrir último caso
                      </Link>
                    ) : null}
                    <Link
                      href={
                        `/clinica-supervisionada/novo?patient_id=${encodeURIComponent(patientItem.patient.id)}` as Route
                      }
                      className="button button-small"
                    >
                      Abrir novo caso
                    </Link>
                  </div>
                ) : (
                  <div className="clinical-case-card-actions">
                    <Link
                      href={
                        `/clinica-supervisionada/novo?patient_id=${encodeURIComponent(patientItem.patient.id)}` as Route
                      }
                      className="button button-small"
                    >
                      Abrir novo caso
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Nenhum paciente corresponde aos filtros atuais da base institucional.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
