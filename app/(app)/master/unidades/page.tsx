import Link from "next/link";
import type { Route } from "next";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterCoordinatorForm } from "@/components/forms/master-coordinator-form";
import { MasterUnitForm } from "@/components/forms/master-unit-form";
import {
  replaceUnitCoordinatorAction,
  toggleUnitStatusAction
} from "@/app/(app)/master/actions";
import {
  createEmptyCoordinatorFormValues,
  createEmptyUnitFormValues
} from "@/app/(app)/master/state";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { getMasterUnitsPageData } from "@/services/master";

function formatLocation(city: string | null, state: string | null) {
  if (city && state) {
    return `${city} / ${state}`;
  }

  return city || state || "Não informado";
}

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterUnitsPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
  }>;
}

export default async function MasterUnitsPage({ searchParams }: MasterUnitsPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const institutionId = readSearchParam(resolvedSearchParams.instituicao);
  const { institutions, units } = await getMasterUnitsPageData();
  const filteredUnits = institutionId
    ? units.filter((unit) => unit.institutionId === institutionId)
    : units;

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Unidades</p>
        <h1>Governança por campus</h1>
        <p>
          Mantenha a estrutura institucional de cada unidade, acompanhe o responsável local e
          abra a visão resumida do campus quando precisar aprofundar a análise.
        </p>
      </section>

      <SectionCard
        title="Cadastrar unidade"
        description="Associe a unidade a uma IES antes de iniciar coordenadores, cursos e operação acadêmica local."
      >
        <div className="management-block-card">
          <MasterUnitForm
            institutions={institutions}
            initialValues={createEmptyUnitFormValues()}
            submitLabel="Cadastrar unidade"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Unidades cadastradas"
        description="Cadastre, edite, ative ou desative unidades e mantenha o coordenador responsável sempre atualizado."
      >
        <form method="get" className="master-filter-form master-filter-form-wide">
          <label className="field">
            <span>Instituição / IES</span>
            <select className="input" name="instituicao" defaultValue={institutionId}>
              <option value="">Todas as instituições</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>

          <div className="actions-row master-filter-actions">
            <button className="button button-secondary" type="submit">
              Aplicar filtro
            </button>
            <Link href={"/master/unidades" as Route} className="button button-secondary">
              Limpar
            </Link>
          </div>
        </form>

        {filteredUnits.length ? (
          <div className="master-scroll-shell table-scroll-sm">
            <div className="master-unit-grid">
              {filteredUnits.map((unit) => (
                <article key={unit.id} className="management-block-card master-unit-card">
                  <div className="management-block-header">
                    <div>
                      <h3>{unit.name}</h3>
                      <p className="field-help">
                        {unit.institutionName} · {unit.acronym} · {unit.slug}
                      </p>
                    </div>
                    <span
                      className={`status-pill ${
                        unit.isActive ? "status-ativo" : "status-inativo"
                      }`}
                    >
                      {unit.isActive ? "ativa" : "inativa"}
                    </span>
                  </div>

                  <div className="report-mini-grid master-unit-mini-grid">
                    <div className="report-mini-card">
                      <span>Instituição / IES</span>
                      <strong>{unit.institutionName}</strong>
                    </div>
                    <div className="report-mini-card">
                      <span>Cidade / UF</span>
                      <strong>{formatLocation(unit.city, unit.state)}</strong>
                    </div>
                    <div className="report-mini-card">
                      <span>Semestres ativos</span>
                      <strong>
                        {unit.activeSemesterCount} / {unit.totalSemesterCount}
                      </strong>
                    </div>
                    <div className="report-mini-card">
                      <span>Coordenador responsável</span>
                      <strong>
                        {unit.coordinator ? unit.coordinator.name : "Não vinculado"}
                      </strong>
                    </div>
                    <div className="report-mini-card">
                      <span>Status do responsável</span>
                      <strong>
                        {unit.coordinator
                          ? unit.coordinator.isActive
                            ? "Ativo"
                            : "Inativo"
                          : "Pendente"}
                      </strong>
                    </div>
                  </div>

                  {unit.pendingItems.length ? (
                    <ul className="master-pending-list">
                      {unit.pendingItems.map((pendingItem) => (
                        <li key={pendingItem}>{pendingItem}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="field-help">
                      A unidade já está com a estrutura institucional mínima cadastrada.
                    </p>
                  )}

                  <div className="actions-row master-unit-actions">
                    <Link
                      href={`/master/unidades/${encodeURIComponent(unit.id)}` as Route}
                      className="button button-secondary button-small"
                    >
                      Abrir unidade
                    </Link>
                    <ConfirmActionForm
                      action={toggleUnitStatusAction}
                      confirmationMessage={`Deseja ${
                        unit.isActive ? "desativar" : "ativar"
                      } a unidade ${unit.name}?`}
                      fields={[
                        { name: "unit_id", value: unit.id },
                        { name: "ativo", value: unit.isActive ? "false" : "true" }
                      ]}
                      className="button button-secondary button-small"
                    >
                      {unit.isActive ? "Desativar unidade" : "Ativar unidade"}
                    </ConfirmActionForm>
                  </div>

                  <details className="master-unit-disclosure">
                    <summary>Editar unidade</summary>
                    <MasterUnitForm
                      institutions={institutions}
                      institutionReadOnly
                      initialValues={{
                        unit_id: unit.id,
                        instituicao_id: unit.institutionId ?? "",
                        nome: unit.name,
                        sigla: unit.acronym,
                        slug: unit.slug,
                        cidade: unit.city ?? "",
                        estado: unit.state ?? ""
                      }}
                      submitLabel="Salvar unidade"
                    />
                  </details>

                  {unit.coordinator ? (
                    <details className="master-unit-disclosure">
                      <summary>Substituir coordenador responsável</summary>
                      <MasterCoordinatorForm
                        unitId={unit.id}
                        action={replaceUnitCoordinatorAction}
                        submitLabel="Substituir coordenador responsável"
                        initialValues={createEmptyCoordinatorFormValues(unit.id, {
                          replace_existing: "true",
                          cargo: unit.coordinator.roleTitle || "Coordenador da unidade"
                        })}
                      />
                    </details>
                  ) : (
                    <details className="master-unit-disclosure">
                      <summary>Cadastrar coordenador da unidade</summary>
                      <MasterCoordinatorForm unitId={unit.id} />
                    </details>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-message">
            Nenhuma unidade encontrada para a instituição selecionada.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
