"use client";

import { useActionState, useEffect, useState } from "react";
import type {
  TceConfigurationActionState,
  TceConfigurationFormValues
} from "@/app/(app)/gestao/tces/state";
import { createInitialTceConfigurationFormValues } from "@/app/(app)/gestao/tces/state";
import type {
  CoordinatorTceAreaOption,
  CoordinatorTceClassOption,
  CoordinatorTceModelOption,
  CoordinatorTceSemesterOption
} from "@/services/tce";
import { TceScheduleFields } from "@/components/forms/tce-schedule-fields";

interface TceConfigurationFormProps {
  action: (
    state: TceConfigurationActionState,
    formData: FormData
  ) => Promise<TceConfigurationActionState>;
  areaOptions: CoordinatorTceAreaOption[];
  classOptions: CoordinatorTceClassOption[];
  courseName: string;
  initialValues?: TceConfigurationFormValues;
  modelOptions: CoordinatorTceModelOption[];
  mode: "create" | "edit";
  missingModelMessage?: string | null;
  offerName?: string | null;
  semesterOptions: CoordinatorTceSemesterOption[];
  submitLabel: string;
  unitName?: string | null;
}

export function TceConfigurationForm({
  action,
  areaOptions,
  classOptions,
  courseName,
  initialValues,
  modelOptions,
  mode,
  missingModelMessage,
  offerName,
  semesterOptions,
  submitLabel,
  unitName
}: TceConfigurationFormProps) {
  const [state, formAction] = useActionState(action, {
    status: "idle",
    message: null,
    fieldErrors: {},
    formValues:
      initialValues ?? createInitialTceConfigurationFormValues(),
    submittedAt: undefined
  } satisfies TceConfigurationActionState);
  const safeState = state ?? {
    status: "idle",
    message: null,
    fieldErrors: {},
    formValues: initialValues ?? createInitialTceConfigurationFormValues()
  };
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<TceConfigurationFormValues>(
    initialValues ?? createInitialTceConfigurationFormValues()
  );

  useEffect(() => {
    setDraft(initialValues ?? createInitialTceConfigurationFormValues());
  }, [initialValues]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft(safeState.formValues);
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (mode === "create" && safeState.status === "success") {
      setDraft(createInitialTceConfigurationFormValues());
    }
  }, [mode, safeState.status, safeState.submittedAt]);

  const visibleClassOptions = classOptions.filter((classOption) => {
    if (draft.semestre_id && classOption.semesterId !== draft.semestre_id) {
      return false;
    }

    if (draft.area_estagio_id && classOption.areaId && classOption.areaId !== draft.area_estagio_id) {
      return false;
    }

    return true;
  });
  const modelsAvailable = modelOptions.length > 0;
  const submitDisabled = !modelsAvailable;

  function updateDraft(field: keyof TceConfigurationFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function updateArea(areaId: string) {
    setDraft((currentDraft) => {
      const nextClassStillValid = classOptions.some(
        (classOption) =>
          classOption.id === currentDraft.turma_id &&
          (!currentDraft.semestre_id || classOption.semesterId === currentDraft.semestre_id) &&
          (!areaId || !classOption.areaId || classOption.areaId === areaId)
      );

      return {
        ...currentDraft,
        area_estagio_id: areaId,
        turma_id: nextClassStillValid ? currentDraft.turma_id : ""
      };
    });
  }

  function updateSemester(semesterId: string) {
    setDraft((currentDraft) => {
      const nextClassStillValid = classOptions.some(
        (classOption) =>
          classOption.id === currentDraft.turma_id &&
          (!semesterId || classOption.semesterId === semesterId) &&
          (!currentDraft.area_estagio_id ||
            !classOption.areaId ||
            classOption.areaId === currentDraft.area_estagio_id)
      );

      return {
        ...currentDraft,
        semestre_id: semesterId,
        turma_id: nextClassStillValid ? currentDraft.turma_id : ""
      };
    });
  }

  function getFieldClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="configuration_id" value={draft.configuration_id} />
      <input type="hidden" name="jornada_semestral" value={draft.jornada_semestral} />

      {safeState.message ? (
        <div
          className={
            safeState.status === "success"
              ? "form-notice form-notice-success"
              : "form-notice form-notice-error"
          }
        >
          {safeState.message}
        </div>
      ) : null}

      {missingModelMessage && !modelsAvailable ? (
        <div className="form-notice form-notice-error">{missingModelMessage}</div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Escopo da configuração</h3>
            <p>
              Esta configuração ficará restrita à oferta atual do coordenador e poderá ser
              refinada por semestre acadêmico e turma.
            </p>
          </div>
        </div>
        <div className="management-tag-list">
          <span className="badge badge-muted">Curso: {courseName}</span>
          {offerName ? <span className="badge badge-muted">Oferta: {offerName}</span> : null}
          {unitName ? <span className="badge badge-muted">Unidade: {unitName}</span> : null}
        </div>
      </div>

      <div className="form-grid">
        <label className={getFieldClassName("modelo_tce_id")}>
          <span>Modelo de TCE</span>
          <select
            className={getInputClassName("modelo_tce_id")}
            name="modelo_tce_id"
            value={draft.modelo_tce_id}
            onChange={(event) => updateDraft("modelo_tce_id", event.currentTarget.value)}
            disabled={!modelsAvailable}
          >
            <option value="">Selecione o modelo</option>
            {modelOptions.map((modelOption) => (
              <option key={modelOption.id} value={modelOption.id}>
                {modelOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.modelo_tce_id ? (
            <span className="field-error">{fieldErrors.modelo_tce_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("nome")}>
          <span>Nome da configuração</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
            placeholder="TCE - Ortopedia - 2026/2"
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName("area_estagio_id")}>
          <span>Área de estágio</span>
          <select
            className={getInputClassName("area_estagio_id")}
            name="area_estagio_id"
            value={draft.area_estagio_id}
            onChange={(event) => updateArea(event.currentTarget.value)}
          >
            <option value="">Selecione a área</option>
            {areaOptions.map((areaOption) => (
              <option key={areaOption.id} value={areaOption.id}>
                {areaOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.area_estagio_id ? (
            <span className="field-error">{fieldErrors.area_estagio_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("semestre_id")}>
          <span>Semestre acadêmico</span>
          <select
            className={getInputClassName("semestre_id")}
            name="semestre_id"
            value={draft.semestre_id}
            onChange={(event) => updateSemester(event.currentTarget.value)}
          >
            <option value="">Todos os semestres visíveis</option>
            {semesterOptions.map((semesterOption) => (
              <option key={semesterOption.id} value={semesterOption.id}>
                {semesterOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.semestre_id ? (
            <span className="field-error">{fieldErrors.semestre_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("turma_id")}>
          <span>Turma</span>
          <select
            className={getInputClassName("turma_id")}
            name="turma_id"
            value={draft.turma_id}
            onChange={(event) => updateDraft("turma_id", event.currentTarget.value)}
          >
            <option value="">Todas as turmas compatíveis</option>
            {visibleClassOptions.map((classOption) => (
              <option key={classOption.id} value={classOption.id}>
                {classOption.label}
              </option>
            ))}
          </select>
          <span className="field-help">
            Se informar uma turma, o semestre será herdado automaticamente quando necessário.
          </span>
          {fieldErrors.turma_id ? (
            <span className="field-error">{fieldErrors.turma_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName("ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) =>
              updateDraft("ativo", event.currentTarget.value === "false" ? "false" : "true")
            }
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Parte concedente</h3>
            <p>
              Preencha os dados fixos da concedente e do local de estágio que aparecerão no
              TCE do aluno.
            </p>
          </div>
        </div>

        <div className="form-grid">
          <label className={getFieldClassName("concedente_razao_social")}>
            <span>Razão social</span>
            <input
              className={getInputClassName("concedente_razao_social")}
              name="concedente_razao_social"
              value={draft.concedente_razao_social}
              onChange={(event) =>
                updateDraft("concedente_razao_social", event.currentTarget.value)
              }
            />
            {fieldErrors.concedente_razao_social ? (
              <span className="field-error">{fieldErrors.concedente_razao_social}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("concedente_documento")}>
            <span>CNPJ/CPF/Código escola</span>
            <input
              className={getInputClassName("concedente_documento")}
              name="concedente_documento"
              value={draft.concedente_documento}
              onChange={(event) =>
                updateDraft("concedente_documento", event.currentTarget.value)
              }
            />
            {fieldErrors.concedente_documento ? (
              <span className="field-error">{fieldErrors.concedente_documento}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("concedente_endereco")}>
            <span>Endereço</span>
            <input
              className={getInputClassName("concedente_endereco")}
              name="concedente_endereco"
              value={draft.concedente_endereco}
              onChange={(event) => updateDraft("concedente_endereco", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("concedente_numero")}>
            <span>Número</span>
            <input
              className={getInputClassName("concedente_numero")}
              name="concedente_numero"
              value={draft.concedente_numero}
              onChange={(event) => updateDraft("concedente_numero", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("concedente_complemento")}>
            <span>Complemento</span>
            <input
              className={getInputClassName("concedente_complemento")}
              name="concedente_complemento"
              value={draft.concedente_complemento}
              onChange={(event) =>
                updateDraft("concedente_complemento", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("concedente_bairro")}>
            <span>Bairro</span>
            <input
              className={getInputClassName("concedente_bairro")}
              name="concedente_bairro"
              value={draft.concedente_bairro}
              onChange={(event) => updateDraft("concedente_bairro", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("concedente_municipio")}>
            <span>Município</span>
            <input
              className={getInputClassName("concedente_municipio")}
              name="concedente_municipio"
              value={draft.concedente_municipio}
              onChange={(event) =>
                updateDraft("concedente_municipio", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("concedente_uf")}>
            <span>UF</span>
            <input
              className={getInputClassName("concedente_uf")}
              name="concedente_uf"
              maxLength={2}
              value={draft.concedente_uf}
              onChange={(event) =>
                updateDraft("concedente_uf", event.currentTarget.value.toUpperCase())
              }
            />
            {fieldErrors.concedente_uf ? (
              <span className="field-error">{fieldErrors.concedente_uf}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("concedente_cep")}>
            <span>CEP</span>
            <input
              className={getInputClassName("concedente_cep")}
              name="concedente_cep"
              value={draft.concedente_cep}
              onChange={(event) => updateDraft("concedente_cep", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("concedente_telefone")}>
            <span>Telefone</span>
            <input
              className={getInputClassName("concedente_telefone")}
              name="concedente_telefone"
              value={draft.concedente_telefone}
              onChange={(event) =>
                updateDraft("concedente_telefone", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("concedente_email")}>
            <span>E-mail</span>
            <input
              className={getInputClassName("concedente_email")}
              name="concedente_email"
              type="email"
              value={draft.concedente_email}
              onChange={(event) => updateDraft("concedente_email", event.currentTarget.value)}
            />
            {fieldErrors.concedente_email ? (
              <span className="field-error">{fieldErrors.concedente_email}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("local_estagio_nome")}>
            <span>Local de estágio</span>
            <input
              className={getInputClassName("local_estagio_nome")}
              name="local_estagio_nome"
              value={draft.local_estagio_nome}
              onChange={(event) => updateDraft("local_estagio_nome", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("local_estagio_endereco")}>
            <span>Endereço do local</span>
            <input
              className={getInputClassName("local_estagio_endereco")}
              name="local_estagio_endereco"
              value={draft.local_estagio_endereco}
              onChange={(event) =>
                updateDraft("local_estagio_endereco", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("local_estagio_numero")}>
            <span>Número do local</span>
            <input
              className={getInputClassName("local_estagio_numero")}
              name="local_estagio_numero"
              value={draft.local_estagio_numero}
              onChange={(event) =>
                updateDraft("local_estagio_numero", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("local_estagio_complemento")}>
            <span>Complemento do local</span>
            <input
              className={getInputClassName("local_estagio_complemento")}
              name="local_estagio_complemento"
              value={draft.local_estagio_complemento}
              onChange={(event) =>
                updateDraft("local_estagio_complemento", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("local_estagio_bairro")}>
            <span>Bairro do local</span>
            <input
              className={getInputClassName("local_estagio_bairro")}
              name="local_estagio_bairro"
              value={draft.local_estagio_bairro}
              onChange={(event) => updateDraft("local_estagio_bairro", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("local_estagio_municipio")}>
            <span>Município do local</span>
            <input
              className={getInputClassName("local_estagio_municipio")}
              name="local_estagio_municipio"
              value={draft.local_estagio_municipio}
              onChange={(event) =>
                updateDraft("local_estagio_municipio", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("local_estagio_uf")}>
            <span>UF do local</span>
            <input
              className={getInputClassName("local_estagio_uf")}
              name="local_estagio_uf"
              maxLength={2}
              value={draft.local_estagio_uf}
              onChange={(event) =>
                updateDraft("local_estagio_uf", event.currentTarget.value.toUpperCase())
              }
            />
            {fieldErrors.local_estagio_uf ? (
              <span className="field-error">{fieldErrors.local_estagio_uf}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("local_estagio_cep")}>
            <span>CEP do local</span>
            <input
              className={getInputClassName("local_estagio_cep")}
              name="local_estagio_cep"
              value={draft.local_estagio_cep}
              onChange={(event) => updateDraft("local_estagio_cep", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("local_estagio_telefone")}>
            <span>Telefone do local</span>
            <input
              className={getInputClassName("local_estagio_telefone")}
              name="local_estagio_telefone"
              value={draft.local_estagio_telefone}
              onChange={(event) =>
                updateDraft("local_estagio_telefone", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("local_estagio_email")}>
            <span>E-mail do local</span>
            <input
              className={getInputClassName("local_estagio_email")}
              name="local_estagio_email"
              type="email"
              value={draft.local_estagio_email}
              onChange={(event) => updateDraft("local_estagio_email", event.currentTarget.value)}
            />
            {fieldErrors.local_estagio_email ? (
              <span className="field-error">{fieldErrors.local_estagio_email}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("responsavel_nome")}>
            <span>Responsável</span>
            <input
              className={getInputClassName("responsavel_nome")}
              name="responsavel_nome"
              value={draft.responsavel_nome}
              onChange={(event) => updateDraft("responsavel_nome", event.currentTarget.value)}
            />
          </label>

          <label className={getFieldClassName("responsavel_documento")}>
            <span>RG ou funcional</span>
            <input
              className={getInputClassName("responsavel_documento")}
              name="responsavel_documento"
              value={draft.responsavel_documento}
              onChange={(event) =>
                updateDraft("responsavel_documento", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("responsavel_conselho")}>
            <span>Conselho profissional e número</span>
            <input
              className={getInputClassName("responsavel_conselho")}
              name="responsavel_conselho"
              value={draft.responsavel_conselho}
              onChange={(event) =>
                updateDraft("responsavel_conselho", event.currentTarget.value)
              }
            />
          </label>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Vigência</h3>
              <p>Defina o período do estágio que será exibido no TCE.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className={getFieldClassName("vigencia_data_inicial")}>
              <span>Data inicial</span>
              <input
                className={getInputClassName("vigencia_data_inicial")}
                type="date"
                name="vigencia_data_inicial"
                value={draft.vigencia_data_inicial}
                onChange={(event) =>
                  updateDraft("vigencia_data_inicial", event.currentTarget.value)
                }
              />
              {fieldErrors.vigencia_data_inicial ? (
                <span className="field-error">{fieldErrors.vigencia_data_inicial}</span>
              ) : null}
            </label>

            <label className={getFieldClassName("vigencia_data_final")}>
              <span>Data final</span>
              <input
                className={getInputClassName("vigencia_data_final")}
                type="date"
                name="vigencia_data_final"
                value={draft.vigencia_data_final}
                onChange={(event) =>
                  updateDraft("vigencia_data_final", event.currentTarget.value)
                }
              />
              {fieldErrors.vigencia_data_final ? (
                <span className="field-error">{fieldErrors.vigencia_data_final}</span>
              ) : null}
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>Jornada</h3>
              <p>Esses campos alimentam o resumo de carga horária do TCE.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className={getFieldClassName("jornada_diaria")}>
              <span>Jornada diária</span>
              <input
                className={getInputClassName("jornada_diaria")}
                name="jornada_diaria"
                value={draft.jornada_diaria}
                onChange={(event) => updateDraft("jornada_diaria", event.currentTarget.value)}
                placeholder="Ex.: 6 horas"
              />
            </label>

            <label className={getFieldClassName("jornada_semanal")}>
              <span>Jornada semanal</span>
              <input
                className={getInputClassName("jornada_semanal")}
                name="jornada_semanal"
                value={draft.jornada_semanal}
                onChange={(event) => updateDraft("jornada_semanal", event.currentTarget.value)}
                placeholder="Ex.: 30 horas"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Horário por dia</h3>
            <p>
              Esses horários servirão de base para o TCE do aluno. Dias não utilizados podem
              ficar em branco.
            </p>
          </div>
        </div>
        <TceScheduleFields
          draft={draft}
          fieldErrors={fieldErrors}
          onChange={updateDraft}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Plano e fechamento</h3>
            <p>
              Complete o plano de atividades e a cidade/data que serão usadas no rodapé do
              documento.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label className={getFieldClassName("cidade_assinatura")}>
            <span>Cidade</span>
            <input
              className={getInputClassName("cidade_assinatura")}
              name="cidade_assinatura"
              value={draft.cidade_assinatura}
              onChange={(event) =>
                updateDraft("cidade_assinatura", event.currentTarget.value)
              }
            />
          </label>

          <label className={getFieldClassName("data_assinatura")}>
            <span>Data final do documento</span>
            <input
              className={getInputClassName("data_assinatura")}
              type="date"
              name="data_assinatura"
              value={draft.data_assinatura}
              onChange={(event) => updateDraft("data_assinatura", event.currentTarget.value)}
            />
            {fieldErrors.data_assinatura ? (
              <span className="field-error">{fieldErrors.data_assinatura}</span>
            ) : null}
          </label>
        </div>

        <label className={getFieldClassName("plano_atividades")}>
          <span>Plano de atividades</span>
          <textarea
            className={`${getInputClassName("plano_atividades")} textarea`}
            name="plano_atividades"
            rows={8}
            value={draft.plano_atividades}
            onChange={(event) => updateDraft("plano_atividades", event.currentTarget.value)}
            placeholder="Descreva as atividades que serão executadas pelo estagiário neste campo."
          />
          {fieldErrors.plano_atividades ? (
            <span className="field-error">{fieldErrors.plano_atividades}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit" disabled={submitDisabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
