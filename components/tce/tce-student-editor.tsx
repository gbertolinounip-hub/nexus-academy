"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  generateStudentTcePdfAction,
  saveStudentTceDataAction
} from "@/app/(app)/tce/actions";
import {
  areStudentTceFormValuesEqual,
  createStudentTceFormValuesFromData,
  initialStudentTceActionState,
  initialStudentTcePdfActionState,
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
  const [pdfState, pdfFormAction, pdfPending] = useActionState(
    generateStudentTcePdfAction,
    {
      ...initialStudentTcePdfActionState,
      generatedAt: entry.savedTce?.generatedAt ?? null
    }
  );
  const safeSaveState = saveState ?? {
    ...initialStudentTceActionState,
    formValues: initialValues,
    savedAt: entry.savedTce?.updatedAt ?? null
  };
  const safePdfState = pdfState ?? {
    ...initialStudentTcePdfActionState,
    generatedAt: entry.savedTce?.generatedAt ?? null
  };
  const [draft, setDraft] = useState<StudentTceFormValues>(initialValues);
  const [lastSavedValues, setLastSavedValues] =
    useState<StudentTceFormValues>(initialValues);
  const [localPdfMessage, setLocalPdfMessage] = useState<string | null>(null);
  const generateFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setDraft(initialValues);
    setLastSavedValues(initialValues);
    setLocalPdfMessage(null);
  }, [initialValues]);

  useEffect(() => {
    if (safeSaveState.formValues) {
      setDraft(safeSaveState.formValues);
    }
  }, [safeSaveState.formValues, safeSaveState.status, safeSaveState.submittedAt]);

  useEffect(() => {
    if (safeSaveState.status === "success" && safeSaveState.formValues) {
      setLastSavedValues(safeSaveState.formValues);
      setLocalPdfMessage(null);
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
    safePdfState.generatedAt ?? entry.savedTce?.generatedAt ?? null;
  const hasPersistedSave = Boolean(effectiveSavedAt);
  const hasUnsavedChanges = !areStudentTceFormValuesEqual(draft, lastSavedValues);
  const generatedPdfIsOutdated = Boolean(
    effectiveGeneratedAt &&
      effectiveSavedAt &&
      new Date(effectiveSavedAt).getTime() > new Date(effectiveGeneratedAt).getTime()
  );
  const downloadHref = `/tce/arquivo/${entry.configuration.id}`;
  const pdfFieldErrors = Object.values(safePdfState.fieldErrors ?? {});

  function handleGeneratePdfClick() {
    if (!hasPersistedSave) {
      setLocalPdfMessage("Salve os dados do TCE antes de gerar o PDF.");
      return;
    }

    if (hasUnsavedChanges) {
      setLocalPdfMessage(
        "VocÃª alterou os dados do TCE. Salve novamente antes de gerar o PDF."
      );
      return;
    }

    setLocalPdfMessage(null);
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
                PDF gerado em {formatDateTime(effectiveGeneratedAt)}
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
                <h3>PDF do TCE</h3>
                <p>
                  O PDF Ã© gerado a partir dos dados salvos e do snapshot da
                  configuraÃ§Ã£o institucional congelado no seu TCE.
                </p>
              </div>
            </div>

            {localPdfMessage ? (
              <div className="form-notice form-notice-error">{localPdfMessage}</div>
            ) : null}

            {safePdfState.message ? (
              <div
                className={
                  safePdfState.status === "success"
                    ? "form-notice form-notice-success"
                    : "form-notice form-notice-error"
                }
              >
                {safePdfState.message}
              </div>
            ) : null}

            {pdfFieldErrors.length ? (
              <div className="stack compact-stack">
                {pdfFieldErrors.map((error, index) => (
                  <p key={`${error}-${index}`} className="field-help field-error">
                    {error}
                  </p>
                ))}
              </div>
            ) : null}

            {!hasPersistedSave ? (
              <p className="field-help">
                Salve os dados do estagiÃ¡rio para habilitar a geraÃ§Ã£o do PDF.
              </p>
            ) : hasUnsavedChanges ? (
              <p className="field-help">
                Existem alteraÃ§Ãµes ainda nÃ£o salvas. Salve novamente antes de gerar
                o PDF.
              </p>
            ) : generatedPdfIsOutdated ? (
              <p className="field-help">
                Seus dados foram atualizados depois da Ãºltima geraÃ§Ã£o. Gere o PDF
                novamente para refletir as informaÃ§Ãµes mais recentes.
              </p>
            ) : effectiveGeneratedAt ? (
              <p className="field-help">
                O PDF jÃ¡ foi gerado. VocÃª pode abrir ou baixar o arquivo e, se
                alterar os dados, gerar uma nova versÃ£o.
              </p>
            ) : (
              <p className="field-help">
                Quando os dados estiverem conferidos e salvos, gere o PDF para
                impressÃ£o e coleta de assinaturas externas.
              </p>
            )}

            <form ref={generateFormRef} action={pdfFormAction}>
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
                onClick={handleGeneratePdfClick}
                disabled={savePending || pdfPending}
              >
                {pdfPending ? "Gerando PDF..." : "Gerar PDF"}
              </button>

              {effectiveGeneratedAt ? (
                <a
                  className="button button-secondary"
                  href={downloadHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir/Baixar PDF
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
