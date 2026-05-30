import { Fragment } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterCoordinatorProfileForm } from "@/components/forms/master-coordinator-profile-form";
import { toggleCoordinatorAccessAction } from "@/app/(app)/master/actions";
import type { MasterCoordinatorDirectoryEntry } from "@/services/master";

interface MasterCoordinatorDirectoryProps {
  entries: MasterCoordinatorDirectoryEntry[];
  emptyMessage: string;
  showUnitColumn?: boolean;
  showOpenUnitAction?: boolean;
}

function formatLinkedDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export function MasterCoordinatorDirectory({
  entries,
  emptyMessage,
  showUnitColumn = false,
  showOpenUnitAction = false
}: MasterCoordinatorDirectoryProps) {
  if (!entries.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  const columnCount = showUnitColumn ? 5 : 4;

  return (
    <div className="master-coordinator-directory">
      <div className="table-wrap master-coordinator-table-wrap">
        <table className="table master-coordinator-table">
          <thead>
            <tr>
              <th>Coordenador</th>
              {showUnitColumn ? <th>Unidade</th> : null}
              <th>Cargo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Fragment key={`${entry.unitId}-${entry.coordinatorId}`}>
                <tr>
                  <td className="master-coordinator-cell-identity">
                    <strong>{entry.name}</strong>
                    <span className="table-helper">{entry.email}</span>
                  </td>
                  {showUnitColumn ? (
                    <td className="master-coordinator-cell-unit">
                      <strong>{entry.unitName}</strong>
                      <span className="table-helper">{entry.unitSlug}</span>
                    </td>
                  ) : null}
                  <td>
                    <strong>{entry.roleTitle}</strong>
                    <span className="table-helper">
                      Vinculado em {formatLinkedDate(entry.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="master-pill-group master-coordinator-status-group">
                      {entry.isResponsible ? (
                        <span className="status-pill status-ativo">Responsável</span>
                      ) : null}
                      <span
                        className={`status-pill ${
                          entry.isActive ? "status-ativo" : "status-inativo"
                        }`}
                      >
                        {entry.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </td>
                  <td className="master-coordinator-cell-actions">
                    <div className="actions-row master-coordinator-actions">
                      {showOpenUnitAction ? (
                        <Link
                          href={`/master/unidades/${encodeURIComponent(entry.unitId)}` as Route}
                          className="button button-secondary button-small"
                        >
                          Abrir unidade
                        </Link>
                      ) : null}
                      <ConfirmActionForm
                        action={toggleCoordinatorAccessAction}
                        confirmationMessage={`Deseja ${
                          entry.isActive ? "desativar" : "ativar"
                        } o acesso de ${entry.name}?`}
                        fields={[
                          { name: "coordinator_id", value: entry.coordinatorId },
                          { name: "unit_id", value: entry.unitId },
                          { name: "ativo", value: entry.isActive ? "false" : "true" }
                        ]}
                        className="button button-secondary button-small"
                      >
                        {entry.isActive ? "Desativar acesso" : "Ativar acesso"}
                      </ConfirmActionForm>
                    </div>
                  </td>
                </tr>
                <tr className="master-coordinator-edit-row">
                  <td colSpan={columnCount}>
                    <details className="master-unit-disclosure master-coordinator-inline-disclosure">
                      <summary>Editar coordenador</summary>
                      <MasterCoordinatorProfileForm
                        initialValues={{
                          coordinator_id: entry.coordinatorId,
                          unit_id: entry.unitId,
                          nome_completo: entry.name,
                          cargo: entry.roleTitle
                        }}
                      />
                    </details>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="master-coordinator-mobile-list">
        {entries.map((entry) => (
          <article
            key={`mobile-${entry.unitId}-${entry.coordinatorId}`}
            className="management-block-card master-coordinator-mobile-card"
          >
            <div className="management-block-header">
              <div>
                <h3>{entry.name}</h3>
                <p className="field-help">{entry.email}</p>
              </div>
              <div className="master-pill-group master-coordinator-status-group">
                {entry.isResponsible ? (
                  <span className="status-pill status-ativo">Responsável</span>
                ) : null}
                <span
                  className={`status-pill ${
                    entry.isActive ? "status-ativo" : "status-inativo"
                  }`}
                >
                  {entry.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>

            <dl className="master-coordinator-mobile-meta">
              {showUnitColumn ? (
                <>
                  <div>
                    <dt>Unidade</dt>
                    <dd>{entry.unitName}</dd>
                  </div>
                  <div>
                    <dt>Slug</dt>
                    <dd>{entry.unitSlug}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Cargo</dt>
                <dd>{entry.roleTitle}</dd>
              </div>
              <div>
                <dt>Vinculado em</dt>
                <dd>{formatLinkedDate(entry.createdAt)}</dd>
              </div>
            </dl>

            <div className="actions-row master-coordinator-actions">
              {showOpenUnitAction ? (
                <Link
                  href={`/master/unidades/${encodeURIComponent(entry.unitId)}` as Route}
                  className="button button-secondary button-small"
                >
                  Abrir unidade
                </Link>
              ) : null}
              <ConfirmActionForm
                action={toggleCoordinatorAccessAction}
                confirmationMessage={`Deseja ${
                  entry.isActive ? "desativar" : "ativar"
                } o acesso de ${entry.name}?`}
                fields={[
                  { name: "coordinator_id", value: entry.coordinatorId },
                  { name: "unit_id", value: entry.unitId },
                  { name: "ativo", value: entry.isActive ? "false" : "true" }
                ]}
                className="button button-secondary button-small"
              >
                {entry.isActive ? "Desativar acesso" : "Ativar acesso"}
              </ConfirmActionForm>
            </div>

            <details className="master-unit-disclosure master-coordinator-inline-disclosure">
              <summary>Editar coordenador</summary>
              <MasterCoordinatorProfileForm
                initialValues={{
                  coordinator_id: entry.coordinatorId,
                  unit_id: entry.unitId,
                  nome_completo: entry.name,
                  cargo: entry.roleTitle
                }}
              />
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
