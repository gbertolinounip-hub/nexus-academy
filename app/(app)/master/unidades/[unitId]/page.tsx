import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { AuditTable } from "@/components/tables/audit-table";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterCoordinatorForm } from "@/components/forms/master-coordinator-form";
import { MasterCoordinatorProfileForm } from "@/components/forms/master-coordinator-profile-form";
import {
  replaceUnitCoordinatorAction,
  toggleCoordinatorAccessAction,
  toggleUnitStatusAction
} from "@/app/(app)/master/actions";
import { createEmptyCoordinatorFormValues } from "@/app/(app)/master/state";
import { requireRole } from "@/lib/auth/session";
import { getMasterUnitDetailPageData } from "@/services/master";

interface MasterUnitDetailPageProps {
  params: Promise<{
    unitId: string;
  }>;
  searchParams?: Promise<{
    inicio?: string | string[];
    fim?: string | string[];
    area?: string | string[];
  }>;
}

function formatLocation(city: string | null, state: string | null) {
  if (city && state) {
    return `${city} / ${state}`;
  }

  return city || state || "Não informado";
}

function semesterStatusLabel(status: "planejado" | "ativo" | "encerrado") {
  switch (status) {
    case "ativo":
      return "Ativo";
    case "encerrado":
      return "Encerrado";
    default:
      return "Planejado";
  }
}

export default async function MasterUnitDetailPage({
  params,
  searchParams
}: MasterUnitDetailPageProps) {
  await requireRole(["coordenador_master"]);
  const { unitId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const unitDetail = await getMasterUnitDetailPageData(unitId, {
    startDate: resolvedSearchParams.inicio,
    endDate: resolvedSearchParams.fim,
    areaId: resolvedSearchParams.area
  });

  if (!unitDetail) {
    notFound();
  }

  return (
    <div className="stack master-dashboard master-unit-detail-page">
      <section className="hero-card">
        <p className="eyebrow">Visão por unidade</p>
        <h1>{unitDetail.unit.name}</h1>
        <p>
          {unitDetail.unit.acronym} · {unitDetail.unit.slug} ·{" "}
          {formatLocation(unitDetail.unit.city, unitDetail.unit.state)}
        </p>
        <div className="actions-row">
          <Link href={"/master/unidades" as Route} className="button button-secondary">
            Voltar para unidades
          </Link>
          <ConfirmActionForm
            action={toggleUnitStatusAction}
            confirmationMessage={`Deseja ${
              unitDetail.unit.isActive ? "desativar" : "ativar"
            } a unidade ${unitDetail.unit.name}?`}
            fields={[
              { name: "unit_id", value: unitDetail.unit.id },
              {
                name: "ativo",
                value: unitDetail.unit.isActive ? "false" : "true"
              }
            ]}
            className="button button-secondary"
          >
            {unitDetail.unit.isActive ? "Desativar unidade" : "Ativar unidade"}
          </ConfirmActionForm>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Coordenadores"
          value={String(unitDetail.summary.activeCoordinators)}
          hint={`${unitDetail.summary.totalCoordinators} vínculo(s) total(is) na unidade.`}
        />
        <MetricCard
          label="Professores"
          value={String(unitDetail.summary.totalProfessors)}
          hint="Cadastros docentes vinculados à unidade."
        />
        <MetricCard
          label="Alunos"
          value={String(unitDetail.summary.totalStudents)}
          hint="Cadastros discentes vinculados à unidade."
        />
        <MetricCard
          label="Semestres ativos"
          value={String(unitDetail.summary.activeSemesters)}
          hint={`${unitDetail.summary.totalSemesters} semestre(s) cadastrado(s).`}
        />
      </div>

      <div className="master-dashboard-panels">
        <SectionCard
          title="Situação geral da unidade"
          description="Leitura rápida do responsável local, da estrutura acadêmica e das pendências institucionais desta operação."
        >
          <div className="master-unit-overview-grid">
            <div className="report-mini-grid master-unit-mini-grid">
              <div className="report-mini-card">
                <span>Coordenador responsável</span>
                <strong>
                  {unitDetail.responsibleCoordinator
                    ? unitDetail.responsibleCoordinator.name
                    : "Não vinculado"}
                </strong>
              </div>
              <div className="report-mini-card">
                <span>Contato</span>
                <strong>
                  {unitDetail.responsibleCoordinator
                    ? unitDetail.responsibleCoordinator.email
                    : "Aguardando cadastro"}
                </strong>
              </div>
              <div className="report-mini-card">
                <span>Turmas vinculadas</span>
                <strong>{unitDetail.summary.totalClasses}</strong>
              </div>
              <div className="report-mini-card">
                <span>Matrículas vinculadas</span>
                <strong>{unitDetail.summary.totalEnrollments}</strong>
              </div>
            </div>

            <div className="master-pending-panel">
              <h3>Pendências institucionais</h3>
              {unitDetail.pendingItems.length ? (
                <ul className="master-pending-list">
                  {unitDetail.pendingItems.map((pendingItem) => (
                    <li key={pendingItem}>{pendingItem}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-message">
                  Nenhuma pendência institucional crítica identificada nesta unidade.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Substituir coordenador responsável"
          description="Use este fluxo quando a unidade precisar trocar a conta principal de coordenação sem misturar a operação institucional com o histórico do responsável anterior."
        >
          <MasterCoordinatorForm
            unitId={unitDetail.unit.id}
            action={replaceUnitCoordinatorAction}
            submitLabel="Substituir coordenador responsável"
            initialValues={createEmptyCoordinatorFormValues(unitDetail.unit.id, {
              replace_existing: "true",
              cargo:
                unitDetail.responsibleCoordinator?.roleTitle ??
                "Coordenador da unidade"
            })}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Coordenadores da unidade"
        description="Acompanhe quem já passou pela coordenação local, ajuste dados básicos e controle o acesso institucional."
      >
        {unitDetail.coordinators.length ? (
          <div className="master-entity-grid">
            {unitDetail.coordinators.map((coordinator) => (
              <article
                key={coordinator.coordinatorId}
                className="management-block-card master-entity-card"
              >
                <div className="management-block-header">
                  <div>
                    <h3>{coordinator.name}</h3>
                    <p className="field-help">{coordinator.email}</p>
                  </div>
                  <div className="master-pill-group">
                    {coordinator.isResponsible ? (
                      <span className="status-pill status-ativo">responsável</span>
                    ) : null}
                    <span
                      className={`status-pill ${
                        coordinator.isActive ? "status-ativo" : "status-inativo"
                      }`}
                    >
                      {coordinator.isActive ? "ativo" : "inativo"}
                    </span>
                  </div>
                </div>

                <div className="report-mini-grid master-unit-mini-grid">
                  <div className="report-mini-card">
                    <span>Cargo</span>
                    <strong>{coordinator.roleTitle}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Vinculado em</span>
                    <strong>{new Date(coordinator.createdAt).toLocaleDateString("pt-BR")}</strong>
                  </div>
                </div>

                <div className="actions-row">
                  <ConfirmActionForm
                    action={toggleCoordinatorAccessAction}
                    confirmationMessage={`Deseja ${
                      coordinator.isActive ? "desativar" : "ativar"
                    } o acesso de ${coordinator.name}?`}
                    fields={[
                      { name: "coordinator_id", value: coordinator.coordinatorId },
                      { name: "unit_id", value: unitDetail.unit.id },
                      {
                        name: "ativo",
                        value: coordinator.isActive ? "false" : "true"
                      }
                    ]}
                    className="button button-secondary button-small"
                  >
                    {coordinator.isActive ? "Desativar acesso" : "Ativar acesso"}
                  </ConfirmActionForm>
                </div>

                <details className="master-unit-disclosure">
                  <summary>Editar coordenador</summary>
                  <MasterCoordinatorProfileForm
                    initialValues={{
                      coordinator_id: coordinator.coordinatorId,
                      unit_id: unitDetail.unit.id,
                      nome_completo: coordinator.name,
                      cargo: coordinator.roleTitle
                    }}
                  />
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Esta unidade ainda não possui coordenadores vinculados.
          </p>
        )}
      </SectionCard>

      <div className="master-dashboard-panels master-unit-detail-stacked-panels">
        <SectionCard
          title="Semestres da unidade"
          description="Visão resumida do ciclo acadêmico cadastrado nesta operação."
        >
          {unitDetail.semesters.length ? (
            <div className="table-wrap">
              <table className="table master-simple-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Período</th>
                  </tr>
                </thead>
                <tbody>
                  {unitDetail.semesters.map((semester) => (
                    <tr key={semester.id}>
                      <td>{semester.code}</td>
                      <td>{semester.name}</td>
                      <td>{semesterStatusLabel(semester.status)}</td>
                      <td>
                        {new Date(semester.startsAt).toLocaleDateString("pt-BR")} até{" "}
                        {new Date(semester.endsAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">
              A unidade ainda não possui semestres cadastrados.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Auditoria recente da unidade"
          description="Movimentações mais recentes registradas para esta unidade."
        >
          <form method="get" className="unit-audit-filter-form">
            <label className="field">
              <span>Data inicial</span>
              <input
                type="date"
                name="inicio"
                className="input"
                defaultValue={unitDetail.auditFilters.startDate}
              />
            </label>

            <label className="field">
              <span>Data final</span>
              <input
                type="date"
                name="fim"
                className="input"
                defaultValue={unitDetail.auditFilters.endDate}
              />
            </label>

            <label className="field">
              <span>Área de estágio</span>
              <select
                name="area"
                className="input"
                defaultValue={unitDetail.auditFilters.areaId}
              >
                <option value="">Todas as áreas</option>
                {unitDetail.auditAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} · {area.blockName}
                  </option>
                ))}
              </select>
            </label>

            <div className="actions-row unit-audit-filter-actions">
              <button type="submit" className="button button-secondary">
                Aplicar filtros
              </button>
              <Link
                href={`/master/unidades/${unitDetail.unit.id}` as Route}
                className="button button-secondary"
              >
                Limpar
              </Link>
            </div>
          </form>

          {unitDetail.recentAuditEntries.length ? (
            <AuditTable entries={unitDetail.recentAuditEntries} />
          ) : (
            <p className="empty-message">
              Ainda não há eventos recentes de auditoria para esta unidade.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
