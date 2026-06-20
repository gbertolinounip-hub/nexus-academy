"use client";

import { useActionState } from "react";
import { toggleTceConfigurationActiveAction, updateTceConfigurationAction } from "@/app/(app)/gestao/tces/actions";
import {
  createInitialTceConfigurationFormValues,
  initialTceConfigurationToggleActionState
} from "@/app/(app)/gestao/tces/state";
import type {
  CoordinatorTceAreaOption,
  CoordinatorTceClassOption,
  CoordinatorTceConfigurationEntry,
  CoordinatorTceModelOption,
  CoordinatorTceSemesterOption
} from "@/services/tce";
import { TceConfigurationForm } from "@/components/forms/tce-configuration-form";

function buildFormValuesFromEntry(
  configuration: CoordinatorTceConfigurationEntry
) {
  const monday = configuration.scheduleData.monday ?? {};
  const tuesday = configuration.scheduleData.tuesday ?? {};
  const wednesday = configuration.scheduleData.wednesday ?? {};
  const thursday = configuration.scheduleData.thursday ?? {};
  const friday = configuration.scheduleData.friday ?? {};
  const saturday = configuration.scheduleData.saturday ?? {};

  return createInitialTceConfigurationFormValues({
    configuration_id: configuration.id,
    modelo_tce_id: configuration.modelId,
    nome: configuration.name,
    area_estagio_id: configuration.stageAreaId,
    semestre_id: configuration.semesterId ?? "",
    turma_id: configuration.classId ?? "",
    ativo: configuration.active ? "true" : "false",
    concedente_razao_social: configuration.concedingPartyData.corporateName ?? "",
    concedente_documento: configuration.concedingPartyData.documentNumber ?? "",
    concedente_endereco: configuration.concedingPartyData.address ?? "",
    concedente_numero: configuration.concedingPartyData.addressNumber ?? "",
    concedente_complemento: configuration.concedingPartyData.addressComplement ?? "",
    concedente_bairro: configuration.concedingPartyData.neighborhood ?? "",
    concedente_municipio: configuration.concedingPartyData.city ?? "",
    concedente_uf: configuration.concedingPartyData.state ?? "",
    concedente_cep: configuration.concedingPartyData.postalCode ?? "",
    concedente_telefone: configuration.concedingPartyData.phone ?? "",
    concedente_email: configuration.concedingPartyData.email ?? "",
    local_estagio_nome: configuration.concedingPartyData.internshipLocation ?? "",
    local_estagio_endereco:
      configuration.concedingPartyData.internshipLocationAddress ?? "",
    local_estagio_numero:
      configuration.concedingPartyData.internshipLocationNumber ?? "",
    local_estagio_complemento:
      configuration.concedingPartyData.internshipLocationComplement ?? "",
    local_estagio_bairro:
      configuration.concedingPartyData.internshipLocationNeighborhood ?? "",
    local_estagio_municipio:
      configuration.concedingPartyData.internshipLocationCity ?? "",
    local_estagio_uf:
      configuration.concedingPartyData.internshipLocationState ?? "",
    local_estagio_cep:
      configuration.concedingPartyData.internshipLocationPostalCode ?? "",
    local_estagio_telefone:
      configuration.concedingPartyData.internshipLocationPhone ?? "",
    local_estagio_email:
      configuration.concedingPartyData.internshipLocationEmail ?? "",
    responsavel_nome: configuration.concedingPartyData.responsibleName ?? "",
    responsavel_documento:
      configuration.concedingPartyData.responsibleDocument ?? "",
    responsavel_conselho:
      configuration.concedingPartyData.professionalCouncil ?? "",
    vigencia_data_inicial: configuration.termData.startsAt ?? "",
    vigencia_data_final: configuration.termData.endsAt ?? "",
    horario_segunda_inicio: monday.startTime ?? "",
    horario_segunda_fim: monday.endTime ?? "",
    horario_segunda_intervalo_inicio: monday.breakStartTime ?? "",
    horario_segunda_intervalo_fim: monday.breakEndTime ?? "",
    horario_terca_inicio: tuesday.startTime ?? "",
    horario_terca_fim: tuesday.endTime ?? "",
    horario_terca_intervalo_inicio: tuesday.breakStartTime ?? "",
    horario_terca_intervalo_fim: tuesday.breakEndTime ?? "",
    horario_quarta_inicio: wednesday.startTime ?? "",
    horario_quarta_fim: wednesday.endTime ?? "",
    horario_quarta_intervalo_inicio: wednesday.breakStartTime ?? "",
    horario_quarta_intervalo_fim: wednesday.breakEndTime ?? "",
    horario_quinta_inicio: thursday.startTime ?? "",
    horario_quinta_fim: thursday.endTime ?? "",
    horario_quinta_intervalo_inicio: thursday.breakStartTime ?? "",
    horario_quinta_intervalo_fim: thursday.breakEndTime ?? "",
    horario_sexta_inicio: friday.startTime ?? "",
    horario_sexta_fim: friday.endTime ?? "",
    horario_sexta_intervalo_inicio: friday.breakStartTime ?? "",
    horario_sexta_intervalo_fim: friday.breakEndTime ?? "",
    horario_sabado_inicio: saturday.startTime ?? "",
    horario_sabado_fim: saturday.endTime ?? "",
    horario_sabado_intervalo_inicio: saturday.breakStartTime ?? "",
    horario_sabado_intervalo_fim: saturday.breakEndTime ?? "",
    jornada_diaria: configuration.dailyWorkload ?? "",
    jornada_semanal: configuration.weeklyWorkload ?? "",
    jornada_semestral: configuration.semesterWorkload ?? "",
    plano_atividades: configuration.activityPlan ?? "",
    cidade_assinatura: configuration.signatureCity ?? "",
    data_assinatura: configuration.signatureDate ?? ""
  });
}

function ensureCurrentModelOption(
  configuration: CoordinatorTceConfigurationEntry,
  modelOptions: CoordinatorTceModelOption[]
) {
  if (modelOptions.some((modelOption) => modelOption.id === configuration.modelId)) {
    return modelOptions;
  }

  return [
    {
      id: configuration.modelId,
      name: configuration.modelName,
      code: configuration.modelCode,
      description: null,
      templateVersion: null,
      scopeLabel: "Modelo atualmente vinculado",
      label: `${configuration.modelName} - modelo atualmente vinculado`
    },
    ...modelOptions
  ];
}

export function TceConfigurationCard({
  areaOptions,
  classOptions,
  configuration,
  courseName,
  modelOptions,
  offerName,
  semesterOptions,
  unitName
}: {
  areaOptions: CoordinatorTceAreaOption[];
  classOptions: CoordinatorTceClassOption[];
  configuration: CoordinatorTceConfigurationEntry;
  courseName: string;
  modelOptions: CoordinatorTceModelOption[];
  offerName?: string | null;
  semesterOptions: CoordinatorTceSemesterOption[];
  unitName?: string | null;
}) {
  const [toggleState, toggleFormAction] = useActionState(
    toggleTceConfigurationActiveAction,
    initialTceConfigurationToggleActionState
  );
  const effectiveModelOptions = ensureCurrentModelOption(configuration, modelOptions);
  const activeLabel = configuration.active ? "Ativa" : "Inativa";
  const validityLabel =
    configuration.termData.startsAt && configuration.termData.endsAt
      ? `${configuration.termData.startsAt} até ${configuration.termData.endsAt}`
      : "Vigência não informada";

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h3>{configuration.name}</h3>
          <p>
            {configuration.stageAreaName}
            {configuration.semesterLabel ? ` · ${configuration.semesterLabel}` : ""}
            {configuration.classLabel ? ` · ${configuration.classLabel}` : ""}
          </p>
        </div>
        <div className="card-actions">
          <form action={toggleFormAction}>
            <input type="hidden" name="configuration_id" value={configuration.id} />
            <input
              type="hidden"
              name="active"
              value={configuration.active ? "false" : "true"}
            />
            <button className="button button-secondary button-small" type="submit">
              {configuration.active ? "Inativar" : "Ativar"}
            </button>
          </form>
        </div>
      </div>

      <div className="management-tag-list">
        <span className={`status-pill status-${configuration.active ? "ativo" : "inativo"}`}>
          {activeLabel}
        </span>
        <span className="badge badge-muted">Modelo: {configuration.modelName}</span>
        <span className="badge badge-muted">{validityLabel}</span>
      </div>

      {toggleState.message ? (
        <p className={toggleState.status === "success" ? "field-help" : "field-error"}>
          {toggleState.message}
        </p>
      ) : null}

      <div className="split-grid">
        <div className="stack">
          <div>
            <strong>Concedente</strong>
            <p className="field-help">
              {configuration.concedingPartyData.corporateName ??
                "Razão social ainda não informada."}
            </p>
          </div>
          <div>
            <strong>Responsável</strong>
            <p className="field-help">
              {configuration.concedingPartyData.responsibleName ??
                "Responsável ainda não informado."}
            </p>
          </div>
          <div>
            <strong>Jornada</strong>
            <p className="field-help">
              {configuration.dailyWorkload ?? "Sem jornada diária"}
              {configuration.weeklyWorkload
                ? ` · ${configuration.weeklyWorkload}`
                : ""}
              {configuration.semesterWorkload
                ? ` · ${configuration.semesterWorkload}`
                : ""}
            </p>
          </div>
        </div>

        <div className="stack">
          <div>
            <strong>Plano de atividades</strong>
            <p className="field-help">
              {configuration.activityPlan
                ? configuration.activityPlan.slice(0, 220)
                : "Plano de atividades ainda não informado."}
              {configuration.activityPlan && configuration.activityPlan.length > 220
                ? "..."
                : ""}
            </p>
          </div>
          <div>
            <strong>Fechamento</strong>
            <p className="field-help">
              {configuration.signatureCity ?? "Cidade não informada"}
              {configuration.signatureDate ? ` · ${configuration.signatureDate}` : ""}
            </p>
          </div>
        </div>
      </div>

      <details>
        <summary>Editar configuração</summary>
        <div className="stack" style={{ marginTop: "1rem" }}>
          <TceConfigurationForm
            action={updateTceConfigurationAction}
            areaOptions={areaOptions}
            classOptions={classOptions}
            courseName={courseName}
            initialValues={buildFormValuesFromEntry(configuration)}
            modelOptions={effectiveModelOptions}
            mode="edit"
            offerName={offerName}
            semesterOptions={semesterOptions}
            submitLabel="Salvar configuração"
            unitName={unitName}
          />
        </div>
      </details>
    </article>
  );
}
