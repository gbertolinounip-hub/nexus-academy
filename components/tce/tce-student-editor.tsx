"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  generateStudentTceDocumentAction,
  saveStudentTceDataAction
} from "@/app/(app)/tce/actions";
import {
  areStudentTceFormValuesEqual,
  createStudentTceFormValuesFromData,
  initialStudentTceActionState,
  initialStudentTceDocumentActionState,
  type StudentTceFormValues
} from "@/app/(app)/tce/state";
import { StudentTceForm } from "@/components/tce/student-tce-form";
import { TcePreview } from "@/components/tce/tce-preview";
import { formatDateTime } from "@/lib/utils/format";
import type { StudentTceAvailableEntry } from "@/services/tce";

interface TceStudentEditorProps {
  entry: StudentTceAvailableEntry;
}

export function TceStudentEditor({ entry }: TceStudentEditorProps) {
  const initialValues = useMemo(
    () =>
      createStudentTceFormValuesFromData({
        configurationId: entry.configuration.id,
        enrollmentId: entry.enrollmentId,
        areaId: entry.areaId,
        studentData: entry.initialStudentData
      }),
    [entry]
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    saveStudentTceDataAction,
    {
      ...initialStudentTceActionState,
      formValues: initialValues,
      savedAt: entry.savedTce?.updatedAt ?? null
    }
  );
  const [documentState, documentFormAction, documentPending] = useActionState(
    generateStudentTceDocumentAction,
    {
      ...initialStudentTceDocumentActionState,
      generatedAt: entry.savedTce?.generatedAt ?? null
    }
  );
  const safeSaveState = saveState ?? {
    ...initialStudentTceActionState,
    formValues: initialValues,
    savedAt: entry.savedTce?.updatedAt ?? null
  };
  const safeDocumentState = documentState ?? {
    ...initialStudentTceDocumentActionState,
    generatedAt: entry.savedTce?.generatedAt ?? null
  };
  const [draft, setDraft] = useState<StudentTceFormValues>(initialValues);
  const [lastSavedValues, setLastSavedValues] =
    useState<StudentTceFormValues>(initialValues);
  const [localDocumentMessage, setLocalDocumentMessage] = useState<string | null>(null);
  const generateFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setDraft(initialValues);
    setLastSavedValues(initialValues);
    setLocalDocumentMessage(null);
  }, [initialValues]);

  useEffect(() => {
    if (safeSaveState.formValues) {
      setDraft(safeSaveState.formValues);
    }
  }, [safeSaveState.formValues, safeSaveState.status, safeSaveState.submittedAt]);

  useEffect(() => {
    if (safeSaveState.status === "success" && safeSaveState.formValues) {
      setLastSavedValues(safeSaveState.formValues);
      setLocalDocumentMessage(null);
    }
  }, [safeSaveState.formValues, safeSaveState.status, safeSaveState.submittedAt]);

  function updateDraft(field: keyof StudentTceFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  const effectiveSavedAt = safeSaveState.savedAt ?? entry.savedTce?.updatedAt ?? null;
  const effectiveGeneratedAt =
    safeDocumentState.generatedAt ?? entry.savedTce?.generatedAt ?? null;
  const hasPersistedSave = Boolean(effectiveSavedAt);
  const hasUnsavedChanges = !areStudentTceFormValuesEqual(draft, lastSavedValues);
  const generatedDocumentIsOutdated = Boolean(
    effectiveGeneratedAt &&
      effectiveSavedAt &&
      new Date(effectiveSavedAt).getTime() > new Date(effectiveGeneratedAt).getTime()
  );
  const downloadHref = `/tce/arquivo/${entry.configuration.id}`;
  const documentFieldErrors = Object.values(safeDocumentState.fieldErrors ?? {});

  function handleGenerateDocumentClick() {
    if (!hasPersistedSave) {
      setLocalDocumentMessage("Salve os dados do TCE antes de gerar o documento.");
      return;
    }

    if (hasUnsavedChanges) {
      setLocalDocumentMessage(
        "Você alterou os dados do TCE. Salve novamente antes de gerar o documento."
      );
      return;
    }

    setLocalDocumentMessage(null);
    generateFormRef.current?.requestSubmit();
  }

  return (
    <div className="stack">
      <div className="management-block-card student-tce-summary-card">
        <div className="student-tce-summary-header">
          <div>
            <h3>{entry.label}</h3>
            <p>{entry.helperText}</p>
          </div>
          <div className="management-tag-list">
            {effectiveSavedAt ? (
              <span className="badge">
                Dados salvos em {formatDateTime(effectiveSavedAt)}
              </span>
            ) : (
              <span className="badge badge-muted">Sem salvamento anterior</span>
            )}
            {effectiveGeneratedAt ? (
              <span className="badge badge-muted">
                TCE gerado em {formatDateTime(effectiveGeneratedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="split-grid student-tce-page-split">
        <div className="student-tce-form-column">
          <StudentTceForm
            entry={entry}
            draft={draft}
            state={safeSaveState}
            formAction={saveFormAction}
            onChange={updateDraft}
            savePending={savePending}
          />

          <div className="card form-stack">
            <div className="card-header">
              <div>
                <h3>Documento final do TCE</h3>
                <p>
                  O arquivo em Word é gerado a partir dos dados salvos e do snapshot
                  institucional congelado no seu TCE.
                </p>
              </div>
            </div>

            {localDocumentMessage ? (
              <div className="form-notice form-notice-error">
                {localDocumentMessage}
              </div>
            ) : null}

            {safeDocumentState.message ? (
              <div
                className={
                  safeDocumentState.status === "success"
                    ? "form-notice form-notice-success"
                    : "form-notice form-notice-error"
                }
              >
                {safeDocumentState.message}
              </div>
            ) : null}

            {documentFieldErrors.length ? (
              <div className="stack compact-stack">
                {documentFieldErrors.map((error, index) => (
                  <p key={`${error}-${index}`} className="field-help field-error">
                    {error}
                  </p>
                ))}
              </div>
            ) : null}

            {!hasPersistedSave ? (
              <p className="field-help">
                Salve os dados do estagiário para habilitar a geração do TCE em
                Word.
              </p>
            ) : hasUnsavedChanges ? (
              <p className="field-help">
                Existem alterações ainda não salvas. Salve novamente antes de gerar
                o TCE.
              </p>
            ) : generatedDocumentIsOutdated ? (
              <p className="field-help">
                Seus dados foram atualizados depois da última geração. Gere o TCE
                novamente para refletir as informações mais recentes.
              </p>
            ) : effectiveGeneratedAt ? (
              <p className="field-help">
                O TCE já foi gerado. Você pode baixar o documento e, se alterar os
                dados, gerar uma nova versão.
              </p>
            ) : (
              <p className="field-help">
                Quando os dados estiverem conferidos e salvos, gere o TCE em Word
                para impressão e coleta de assinaturas externas.
              </p>
            )}

            <form ref={generateFormRef} action={documentFormAction}>
              <input
                type="hidden"
                name="configuration_id"
                value={entry.configuration.id}
              />
            </form>

            <div className="actions-row">
              <button
                className="button"
                type="button"
                onClick={handleGenerateDocumentClick}
                disabled={savePending || documentPending}
              >
                {documentPending ? "Gerando TCE..." : "Gerar TCE"}
              </button>

              {effectiveGeneratedAt ? (
                <a
                  className="button button-secondary"
                  href={downloadHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Baixar TCE em Word
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="student-tce-preview-column">
          <TcePreview entry={entry} draft={draft} />
        </div>
      </div>
    </div>
  );
}
