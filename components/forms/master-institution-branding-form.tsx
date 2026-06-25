"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateInstitutionBrandingAction } from "@/app/(app)/master/instituicoes/actions";
import {
  createEmptyInstitutionBrandingFormValues,
  initialInstitutionBrandingActionState,
  type InstitutionBrandingFormValues
} from "@/app/(app)/master/instituicoes/state";
import type { InstitutionManagementEntry } from "@/services/institution-management";

interface MasterInstitutionBrandingFormProps {
  institutions: InstitutionManagementEntry[];
}

function getFieldClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "field field-invalid" : "field";
}

function getInputClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "input input-invalid" : "input";
}

function buildBrandingDraft(
  institution: InstitutionManagementEntry | null
): InstitutionBrandingFormValues {
  if (!institution) {
    return createEmptyInstitutionBrandingFormValues();
  }

  return {
    institution_id: institution.id,
    nome_exibicao: institution.displayName ?? "",
    remove_logo_principal: "false",
    remove_logo_compacta: "false"
  };
}

function InstitutionLogoPreviewCard({
  title,
  previewUrl,
  removeRequested,
  emptyLabel,
  imageAlt,
  imageClassName
}: {
  title: string;
  previewUrl: string | null;
  removeRequested: boolean;
  emptyLabel: string;
  imageAlt: string;
  imageClassName: string;
}) {
  return (
    <div className="institution-branding-preview-card">
      <div className="institution-branding-preview-copy">
        <strong>{title}</strong>
        <span className="field-help">
          {removeRequested
            ? "A imagem atual será removida ao salvar."
            : previewUrl
              ? "Pré-visualização da imagem atual."
              : emptyLabel}
        </span>
      </div>

      <div className="institution-branding-preview-frame">
        {removeRequested ? (
          <span className="badge badge-muted">Remoção pendente</span>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={imageAlt}
            className={imageClassName}
            loading="lazy"
          />
        ) : (
          <span className="badge badge-muted">Nenhuma imagem</span>
        )}
      </div>
    </div>
  );
}

export function MasterInstitutionBrandingForm({
  institutions
}: MasterInstitutionBrandingFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateInstitutionBrandingAction,
    initialInstitutionBrandingActionState
  );
  const safeState = state ?? initialInstitutionBrandingActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<InstitutionBrandingFormValues>(() =>
    buildBrandingDraft(institutions[0] ?? null)
  );

  const selectedInstitution =
    institutions.find((institution) => institution.id === draft.institution_id) ?? null;

  useEffect(() => {
    if (!draft.institution_id && institutions[0]) {
      setDraft(buildBrandingDraft(institutions[0]));
      return;
    }

    if (
      draft.institution_id &&
      !institutions.some((institution) => institution.id === draft.institution_id)
    ) {
      setDraft(buildBrandingDraft(institutions[0] ?? null));
    }
  }, [draft.institution_id, institutions]);

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft((currentDraft) => ({
        ...currentDraft,
        remove_logo_principal: "false",
        remove_logo_compacta: "false"
      }));
      router.refresh();
    }
  }, [router, safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(
    field: keyof InstitutionBrandingFormValues,
    value: InstitutionBrandingFormValues[keyof InstitutionBrandingFormValues]
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleInstitutionSelection(institutionId: string) {
    const institution =
      institutions.find((entry) => entry.id === institutionId) ?? null;
    setDraft(buildBrandingDraft(institution));
  }

  const formDisabled = institutions.length === 0;

  return (
    <form action={formAction} className="form-stack master-institution-branding-form">
      <input
        type="hidden"
        name="remove_logo_principal"
        value={draft.remove_logo_principal}
      />
      <input
        type="hidden"
        name="remove_logo_compacta"
        value={draft.remove_logo_compacta}
      />

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

      {formDisabled ? (
        <div className="form-notice">
          Cadastre ao menos uma instituição antes de configurar a identidade visual.
        </div>
      ) : null}

      <div className="master-institution-branding-layout">
        <div className="management-block-card master-institution-branding-panel">
          <div className="management-block-header">
            <div>
              <h3>Configurar identidade visual</h3>
              <p className="field-help">
                Selecione uma IES já cadastrada para definir nome de exibição e logos
                usados apenas dentro do sistema autenticado.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label className={getFieldClassName(fieldErrors, "institution_id")}>
              <span>Instituição / IES</span>
              <select
                className={getInputClassName(fieldErrors, "institution_id")}
                name="institution_id"
                value={draft.institution_id}
                disabled={formDisabled}
                onChange={(event) => handleInstitutionSelection(event.currentTarget.value)}
              >
                <option value="">Selecione a instituição</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
              {selectedInstitution ? (
                <span className="field-help">
                  Slug: {selectedInstitution.slug} · Status:{" "}
                  {selectedInstitution.isActive ? "ativa" : "inativa"}
                </span>
              ) : null}
              {fieldErrors.institution_id ? (
                <span className="field-error">{fieldErrors.institution_id}</span>
              ) : null}
            </label>

            <label className={getFieldClassName(fieldErrors, "nome_exibicao")}>
              <span>Nome de exibição</span>
              <input
                className={getInputClassName(fieldErrors, "nome_exibicao")}
                name="nome_exibicao"
                value={draft.nome_exibicao}
                disabled={formDisabled}
                onChange={(event) => updateDraft("nome_exibicao", event.currentTarget.value)}
                placeholder="Opcional. Ex.: Universidade Paulista - UNIP"
              />
              <span className="field-help">
                Quando preenchido, este nome fica disponível para uso interno no sistema
                em vez do nome cadastral.
              </span>
              {fieldErrors.nome_exibicao ? (
                <span className="field-error">{fieldErrors.nome_exibicao}</span>
              ) : null}
            </label>
          </div>

          <div className="master-institution-branding-preview-grid">
            <InstitutionLogoPreviewCard
              title="Logo principal atual"
              previewUrl={selectedInstitution?.primaryLogoUrl ?? null}
              removeRequested={draft.remove_logo_principal === "true"}
              emptyLabel="Nenhuma logo principal configurada."
              imageAlt={`Logo principal da ${selectedInstitution?.displayName ?? selectedInstitution?.name ?? "instituição"}`}
              imageClassName="institution-branding-preview-image institution-branding-preview-image-primary"
            />

            <InstitutionLogoPreviewCard
              title="Logo compacta atual"
              previewUrl={selectedInstitution?.compactLogoUrl ?? null}
              removeRequested={draft.remove_logo_compacta === "true"}
              emptyLabel="Nenhuma logo compacta configurada."
              imageAlt={`Logo compacta da ${selectedInstitution?.displayName ?? selectedInstitution?.name ?? "instituição"}`}
              imageClassName="institution-branding-preview-image institution-branding-preview-image-compact"
            />
          </div>

          <div className="form-grid">
            <label className={getFieldClassName(fieldErrors, "logo_principal_file")}>
              <span>Logo principal</span>
              <input
                type="file"
                name="logo_principal_file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className={getInputClassName(fieldErrors, "logo_principal_file")}
                disabled={formDisabled}
              />
              <span className="field-help">
                PNG, JPG, JPEG ou WEBP com até 1 MB.
              </span>
              {selectedInstitution?.primaryLogoPath ? (
                <label className="master-institution-branding-toggle">
                  <input
                    type="checkbox"
                    checked={draft.remove_logo_principal === "true"}
                    onChange={(event) =>
                      updateDraft(
                        "remove_logo_principal",
                        event.currentTarget.checked ? "true" : "false"
                      )
                    }
                  />
                  <span>Remover logo principal atual</span>
                </label>
              ) : null}
              {fieldErrors.logo_principal_file ? (
                <span className="field-error">{fieldErrors.logo_principal_file}</span>
              ) : null}
            </label>

            <label className={getFieldClassName(fieldErrors, "logo_compacta_file")}>
              <span>Logo compacta</span>
              <input
                type="file"
                name="logo_compacta_file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className={getInputClassName(fieldErrors, "logo_compacta_file")}
                disabled={formDisabled}
              />
              <span className="field-help">
                PNG, JPG, JPEG ou WEBP com até 1 MB.
              </span>
              {selectedInstitution?.compactLogoPath ? (
                <label className="master-institution-branding-toggle">
                  <input
                    type="checkbox"
                    checked={draft.remove_logo_compacta === "true"}
                    onChange={(event) =>
                      updateDraft(
                        "remove_logo_compacta",
                        event.currentTarget.checked ? "true" : "false"
                      )
                    }
                  />
                  <span>Remover logo compacta atual</span>
                </label>
              ) : null}
              {fieldErrors.logo_compacta_file ? (
                <span className="field-error">{fieldErrors.logo_compacta_file}</span>
              ) : null}
            </label>
          </div>

          <div className="actions-row">
            <button className="button" type="submit" disabled={formDisabled}>
              Salvar identidade visual
            </button>
          </div>
        </div>

        <div className="management-block-card master-institution-branding-guidance">
          <div className="management-block-header">
            <div>
              <h3>Orientações de imagem</h3>
              <p className="field-help">
                As logos são ajustadas automaticamente sem distorção dentro do menu
                lateral e de futuras áreas internas.
              </p>
            </div>
          </div>

          <div className="master-institution-branding-guidance-stack">
            <div className="master-institution-branding-guidance-card">
              <strong>Logo principal</strong>
              <ul>
                <li>Formato recomendado: PNG com fundo transparente.</li>
                <li>Proporção recomendada: horizontal.</li>
                <li>Tamanho recomendado: 800 x 240 px.</li>
                <li>Tamanho máximo sugerido: 1 MB.</li>
                <li>A imagem será ajustada automaticamente sem distorção.</li>
              </ul>
            </div>

            <div className="master-institution-branding-guidance-card">
              <strong>Logo compacta</strong>
              <ul>
                <li>Formato recomendado: PNG com fundo transparente.</li>
                <li>Proporção recomendada: quadrada.</li>
                <li>Tamanho recomendado: 512 x 512 px.</li>
                <li>Tamanho máximo sugerido: 1 MB.</li>
                <li>A imagem será ajustada automaticamente sem distorção.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
