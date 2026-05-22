import Link from "next/link";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ProgressBars } from "@/components/dashboard/progress-bars";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { updateSemesterStatusAction } from "@/app/(app)/gestao/alunos/actions";
import { requireRole } from "@/lib/auth/session";
import { formatPercentage } from "@/lib/utils/format";
import { getAuthenticatedCoordinatorDashboard } from "@/services/dashboard";

interface CoordinatorDashboardPageProps {
  searchParams?: Promise<{
    area?: string | string[];
    notice?: string;
    notice_type?: "success" | "error";
  }>;
}

function statusLabel(status: "bem" | "atencao" | "critico") {
  switch (status) {
    case "critico":
      return "Crítico";
    case "atencao":
      return "Atenção";
    default:
      return "Satisfatório";
  }
}

export default async function CoordinatorDashboardPage({
  searchParams
}: CoordinatorDashboardPageProps) {
  const currentUser = await requireRole(["coordenador"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const notice = resolvedSearchParams?.notice?.trim() ?? "";
  const noticeType =
    resolvedSearchParams?.notice_type === "success" ? "success" : "error";
  const { dashboard, emptyState } = await getAuthenticatedCoordinatorDashboard(
    currentUser
  );

  if (!dashboard || emptyState) {
    return (
      <div className="stack">
        <section className="hero-card">
          <p className="eyebrow">Painel do coordenador</p>
          <h1>{currentUser.name}</h1>
          <p>
            Seu acesso está ativo, mas ainda não foi possível montar o painel
            com dados acadêmicos reais.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Painel indisponível"}
          description={
            emptyState?.description ??
            "Ainda não encontramos dados suficientes para consolidar a visão da coordenação."
          }
          actions={
            <Link href="/relatorios" className="button button-secondary">
              Ver relatórios
            </Link>
          }
        >
          <p className="empty-message">
            Quando houver semestres, turmas, matrículas e lançamentos publicados
            no banco, este painel exibirá os dados reais da coordenação.
          </p>
        </SectionCard>
      </div>
    );
  }

  const requestedAreaId = Array.isArray(resolvedSearchParams?.area)
    ? resolvedSearchParams?.area[0]
    : resolvedSearchParams?.area;
  const selectedArea =
    dashboard.areaGroupAverages.find((area) => area.areaId === requestedAreaId) ??
    dashboard.areaGroupAverages[0] ??
    null;

  return (
    <div className="stack reports-dashboard coordinator-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Painel do coordenador</p>
        <h1>{dashboard.coordinator.name}</h1>
        <p>
          Visão consolidada da operação acadêmica, com foco em áreas do estágio
          e casos que pedem acompanhamento mais próximo.
        </p>
        <div className="actions-row">
          <Link href="/gestao/alunos" className="button button-secondary">
            Gestão acadêmica
          </Link>
          {dashboard.semesterStatus === "ativo" ? (
            <ConfirmActionForm
              action={updateSemesterStatusAction}
              confirmationMessage={`Encerrar o semestre ${dashboard.semester.code}? Isso concluirá matrículas ativas, encerrará vínculos de supervisão e arquivará o acesso operacional dos alunos sem outro semestre ativo.`}
              fields={[
                {
                  name: "semester_id",
                  value: dashboard.semester.id
                },
                {
                  name: "status",
                  value: "encerrado"
                },
                {
                  name: "return_to",
                  value: `/coordenador?area=${encodeURIComponent(selectedArea?.areaId ?? "")}`
                }
              ]}
              className="button"
            >
              Encerrar semestre
            </ConfirmActionForm>
          ) : null}
        </div>
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

      <div className="metrics-grid">
        <MetricCard
          label="Alunos ativos"
          value={String(dashboard.totalStudents)}
          hint="Total de alunos matriculados no semestre."
        />
        <MetricCard
          label="Professores ativos"
          value={String(dashboard.totalProfessors)}
          hint="Docentes vinculados às turmas do estágio."
        />
      </div>

      <div className="split-grid">
        <SectionCard
          title="Blocos avaliativos por área"
          description={
            selectedArea
              ? `Médias dos blocos avaliativos da área ${selectedArea.areaName} no semestre principal.`
              : "Ainda não há área com alunos ativos suficiente para consolidar este gráfico."
          }
        >
          {selectedArea ? (
            <>
              <div className="report-chip-list coordinator-dashboard-filter-list">
                {dashboard.areaGroupAverages.map((area) => (
                  <Link
                    key={area.areaId}
                    href={`/coordenador?area=${encodeURIComponent(area.areaId)}`}
                    className={`report-chip ${
                      selectedArea?.areaId === area.areaId
                        ? "report-chip-active"
                        : ""
                    }`}
                  >
                    {area.areaName}
                  </Link>
                ))}
              </div>

              <ProgressBars
                items={selectedArea.groups.map((group) => ({
                  label: group.groupName,
                  current: group.averagePercentage,
                  max: group.weightPercentage
                }))}
              />
            </>
          ) : (
            <p className="empty-message">
              Ainda não há áreas com alunos ativos suficientes para consolidar
              esta visão.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Casos prioritários"
          description="Alunos que merecem acompanhamento mais próximo."
          actions={
            <Link href="/relatorios" className="button button-secondary">
              Ver relatórios
            </Link>
          }
        >
          <ul className="detail-list">
            {dashboard.criticalStudents.map((student) => (
              <li className="detail-item" key={student.enrollmentId}>
                <span>{student.studentName}</span>
                <span>
                  {formatPercentage(student.finalPercentage)} · {statusLabel(student.status)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Cobertura por área"
        description="Distribuição real de alunos e supervisores por área de estágio no semestre principal."
      >
        {dashboard.areaCoverage.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bloco</th>
                  <th>Área</th>
                  <th>Alunos</th>
                  <th>Supervisores</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.areaCoverage.map((area) => (
                  <tr key={area.areaId}>
                    <td>{area.blockName}</td>
                    <td>{area.areaName}</td>
                    <td>{area.studentCount}</td>
                    <td>{area.professorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Ainda não há cobertura por área suficiente para exibição.
          </p>
        )}
      </SectionCard>
    </div>
  );
}




