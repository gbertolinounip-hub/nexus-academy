"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/common/section-card";
import { TceAvailableCard } from "@/components/tce/tce-available-card";
import { TceStudentEditor } from "@/components/tce/tce-student-editor";
import type { StudentTcePageData } from "@/services/tce";

interface TceStudentPageClientProps {
  pageData: StudentTcePageData;
}

export function TceStudentPageClient({ pageData }: TceStudentPageClientProps) {
  const [selectedEntryKey, setSelectedEntryKey] = useState(
    pageData.availableTces[0]?.entryKey ?? ""
  );
  const selectedEntry = useMemo(
    () =>
      pageData.availableTces.find((entry) => entry.entryKey === selectedEntryKey) ??
      pageData.availableTces[0] ??
      null,
    [pageData.availableTces, selectedEntryKey]
  );

  return (
    <>
      <SectionCard
        title="Resumo do vínculo"
        description="Dados acadêmicos básicos usados como base para localizar o TCE aplicável ao seu estágio."
      >
        <div className="report-mini-grid student-tce-summary-grid">
          <div className="report-mini-card">
            <span>Aluno</span>
            <strong>{pageData.student.name}</strong>
          </div>
          <div className="report-mini-card">
            <span>Matrícula</span>
            <strong>{pageData.student.registration}</strong>
          </div>
          <div className="report-mini-card">
            <span>Curso</span>
            <strong>{pageData.student.courseName}</strong>
          </div>
          <div className="report-mini-card">
            <span>Unidade</span>
            <strong>{pageData.student.unitName ?? "Não informada"}</strong>
          </div>
        </div>
      </SectionCard>

      {pageData.warnings.length ? (
        <SectionCard
          title="Avisos do TCE"
          description="Mensagens de contexto quando o sistema encontra lacunas ou mais de uma configuração possível."
        >
          <div className="student-tce-warning-list">
            {pageData.warnings.map((warning, index) => (
              <div key={`${warning}-${index}`} className="form-notice form-notice-error">
                {warning}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="TCEs disponíveis"
        description="Selecione o TCE correspondente à sua área de estágio para preencher os dados do estagiário e acompanhar a prévia do documento."
      >
        {pageData.availableTces.length ? (
          <div className="student-tce-available-list">
            {pageData.availableTces.map((entry) => (
              <TceAvailableCard
                key={entry.entryKey}
                entry={entry}
                selected={selectedEntry?.entryKey === entry.entryKey}
                onSelect={setSelectedEntryKey}
              />
            ))}
          </div>
        ) : (
          <p className="field-help">
            Nenhum TCE disponível para sua matrícula/área de estágio no momento.
          </p>
        )}
      </SectionCard>

      {selectedEntry ? (
        <SectionCard
          title="Preenchimento do TCE"
          description="À esquerda você revisa os dados do estagiário. À direita a prévia HTML acompanha o documento em tempo real."
        >
          <TceStudentEditor key={selectedEntry.entryKey} entry={selectedEntry} />
        </SectionCard>
      ) : null}
    </>
  );
}
