"use client";

import { useActionState } from "react";
import { processStudentImportAction } from "@/app/(app)/gestao/alunos/importar/actions";
import { initialStudentImportActionState } from "@/app/(app)/gestao/alunos/state";

function buildPreviewStatusLabel(status: string) {
  switch (status) {
    case "importada":
      return "Importada";
    case "falha":
      return "Falha";
    case "duplicada":
      return "Duplicada";
    case "invalida":
      return "Inválida";
    default:
      return "Válida";
  }
}

function buildPreviewStatusClassName(status: string) {
  switch (status) {
    case "importada":
      return "status-pill status-imported";
    case "falha":
      return "status-pill status-failed";
    case "duplicada":
      return "status-pill status-duplicate";
    case "invalida":
      return "status-pill status-invalid";
    default:
      return "status-pill status-ready";
  }
}

export function StudentImportForm() {
  const [state, formAction] = useActionState(
    processStudentImportAction,
    initialStudentImportActionState
  );
  const safeState = state ?? initialStudentImportActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const previewRows = safeState.rows ?? [];
  const readyRows = previewRows.filter((row) =>
    ["valida", "importada", "falha"].includes(row.status)
  );
  const blockedRows = previewRows.filter((row) =>
    ["duplicada", "invalida"].includes(row.status)
  );
  const canConfirmImport =
    safeState.importableRows.length > 0 && safeState.status !== "success";
  const noticeClassName =
    safeState.status === "error" ||
    (safeState.status === "preview" && safeState.summary.validRows === 0)
      ? "form-notice form-notice-error"
      : "form-notice form-notice-success";

  return (
    <div className="form-stack management-import-stack">
      {safeState.message ? <div className={noticeClassName}>{safeState.message}</div> : null}

      <form action={formAction} className="form-stack management-import-form">
        <input type="hidden" name="intent" value="preview" />

        <div className="management-block-card management-import-guidance-card">
          <div className="management-block-header">
            <div>
              <h3>Enviar planilha de alunos</h3>
              <p className="field-help">
                Aceite arquivos <strong>.xlsx</strong>, <strong>.xls</strong> ou{" "}
                <strong>.csv</strong> com as colunas <code>nome_completo</code>,{" "}
                <code>ra</code>, <code>celular</code> e <code>email</code>.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label
              className={
                fieldErrors.spreadsheet ? "field field-invalid" : "field"
              }
            >
              <span>Planilha de importação</span>
              <input
                className={fieldErrors.spreadsheet ? "input input-invalid" : "input"}
                type="file"
                name="spreadsheet"
                accept=".xlsx,.xls,.csv"
              />
              <span className="field-help">
                A senha temporária seguirá o padrão <strong>Nx@</strong> + os{" "}
                <strong>6 últimos dígitos do celular</strong>.
              </span>
              {fieldErrors.spreadsheet ? (
                <span className="field-error">{fieldErrors.spreadsheet}</span>
              ) : null}
            </label>
          </div>

          <div className="actions-row">
            <button className="button" type="submit">
              Validar planilha
            </button>
          </div>
        </div>
      </form>

      {previewRows.length ? (
        <>
          <div className="report-mini-grid management-import-summary-grid">
            <div className="report-mini-card">
              <span>Linhas analisadas</span>
              <strong>{safeState.summary.totalRows}</strong>
            </div>
            <div className="report-mini-card">
              <span>Prontas para importar</span>
              <strong>{safeState.summary.validRows}</strong>
            </div>
            <div className="report-mini-card">
              <span>Duplicadas</span>
              <strong>{safeState.summary.duplicateRows}</strong>
            </div>
            <div className="report-mini-card">
              <span>Inválidas</span>
              <strong>{safeState.summary.invalidRows}</strong>
            </div>
            <div className="report-mini-card">
              <span>Importadas</span>
              <strong>{safeState.summary.importedRows}</strong>
            </div>
            <div className="report-mini-card">
              <span>Falhas na confirmação</span>
              <strong>{safeState.summary.failedRows}</strong>
            </div>
          </div>

          <div className="management-block-card management-import-guidance-card">
            <div className="management-block-header">
              <div>
                <h3>Prévia da importação</h3>
                <p className="field-help">
                  Arquivo analisado: <strong>{safeState.fileName}</strong>
                  {safeState.fileTypeLabel ? ` · ${safeState.fileTypeLabel}` : ""}
                </p>
              </div>
            </div>
            <p className="field-help">
              A senha inicial não fica exposta por completo nesta tela. O sistema
              gera automaticamente <strong>Nx@</strong> + os 6 últimos dígitos
              do celular e marca o cadastro como desativado até a ativação
              operacional do aluno.
            </p>

            {canConfirmImport ? (
              <form action={formAction} className="actions-row">
                <input type="hidden" name="intent" value="import" />
                <input
                  type="hidden"
                  name="import_payload"
                  value={JSON.stringify(safeState.importableRows)}
                />
                <input type="hidden" name="file_name" value={safeState.fileName ?? ""} />
                <input
                  type="hidden"
                  name="file_type_label"
                  value={safeState.fileTypeLabel ?? ""}
                />
                <button className="button" type="submit">
                  Importar {safeState.importableRows.length} aluno(s) válido(s)
                </button>
              </form>
            ) : null}
          </div>

          {readyRows.length ? (
            <div className="management-import-preview-stack">
              <div className="card management-import-preview-card">
                <div className="card-header">
                  <div>
                    <h2>Linhas válidas e processadas</h2>
                    <p>
                      Alunos que podem ser importados ou que já foram processados
                      neste lote.
                    </p>
                  </div>
                </div>
                <div className="table-wrap management-import-table-wrap">
                  <table className="table management-import-table">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Nome</th>
                        <th>RA</th>
                        <th>Celular</th>
                        <th>E-mail</th>
                        <th>Senha inicial</th>
                        <th>Status</th>
                        <th>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.email}-${row.ra}`}>
                          <td>{row.rowNumber}</td>
                          <td>{row.nome_completo}</td>
                          <td>{row.ra}</td>
                          <td>{row.celular}</td>
                          <td>{row.email}</td>
                          <td>{row.temporaryPasswordMasked}</td>
                          <td>
                            <span className={buildPreviewStatusClassName(row.status)}>
                              {buildPreviewStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            {row.issues.length ? (
                              <div className="management-import-issue-list">
                                {row.issues.map((issue) => (
                                  <span key={issue}>{issue}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="table-helper">
                                Sem inconsistências nesta linha.
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {blockedRows.length ? (
            <div className="card management-import-preview-card">
              <div className="card-header">
                <div>
                  <h2>Linhas bloqueadas</h2>
                  <p>
                    Estas linhas não serão importadas enquanto houver erro,
                    duplicidade ou cadastro-base já existente.
                  </p>
                </div>
              </div>
              <div className="table-wrap management-import-table-wrap">
                <table className="table management-import-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>RA</th>
                      <th>Celular</th>
                      <th>E-mail</th>
                      <th>Status</th>
                      <th>Motivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.email}-${row.ra}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.nome_completo || "Não informado"}</td>
                        <td>{row.ra || "Não informado"}</td>
                        <td>{row.celular || "Não informado"}</td>
                        <td>{row.email || "Não informado"}</td>
                        <td>
                          <span className={buildPreviewStatusClassName(row.status)}>
                            {buildPreviewStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="management-import-issue-list">
                            {row.issues.map((issue) => (
                              <span key={issue}>{issue}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
