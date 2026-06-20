import { formatDate } from "@/lib/utils/format";
import type { StudentTceFormValues } from "@/app/(app)/tce/state";
import type { StudentTceAvailableEntry } from "@/services/tce";

type TcePreviewScheduleDay =
  StudentTceAvailableEntry["configuration"]["scheduleData"][keyof StudentTceAvailableEntry["configuration"]["scheduleData"]];

interface TcePreviewProps {
  entry: StudentTceAvailableEntry;
  draft: StudentTceFormValues;
}

const scheduleRows: Array<{
  key: keyof StudentTceAvailableEntry["configuration"]["scheduleData"];
  label: string;
}> = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" }
];

function displayText(value: string | null | undefined, fallback = "Não informado") {
  return typeof value === "string" && value.trim().length ? value.trim() : fallback;
}

function formatPreviewDate(value: string | null | undefined) {
  if (!value) {
    return "Não informado";
  }

  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function formatTimeRange(day: TcePreviewScheduleDay | null | undefined) {
  if (!day?.startTime || !day?.endTime) {
    return "Não informado";
  }

  return `${day.startTime} às ${day.endTime}`;
}

function formatBreakRange(day: TcePreviewScheduleDay | null | undefined) {
  if (!day?.breakStartTime || !day?.breakEndTime) {
    return "Sem intervalo";
  }

  return `${day.breakStartTime} às ${day.breakEndTime}`;
}

export function TcePreview({ entry, draft }: TcePreviewProps) {
  const concedingParty = entry.configuration.concedingPartyData;
  const termData = entry.configuration.termData;
  const scheduleData = entry.configuration.scheduleData;

  return (
    <div className="tce-preview-shell">
      <div className="tce-preview-document">
        <header className="tce-preview-header">
          <p className="tce-preview-kicker">Prévia institucional</p>
          <h2>Termo de Compromisso de Estágio</h2>
          <p>
            Representação HTML para conferência do conteúdo. O PDF final manterá o
            layout institucional completo do modelo oficial.
          </p>
        </header>

        <section className="tce-preview-section">
          <h3>Parte Concedente</h3>
          <div className="tce-preview-grid">
            <div>
              <span>Razão social</span>
              <strong>{displayText(concedingParty.corporateName)}</strong>
            </div>
            <div>
              <span>CNPJ/CPF/Código escola</span>
              <strong>{displayText(concedingParty.documentNumber)}</strong>
            </div>
            <div>
              <span>Responsável</span>
              <strong>{displayText(concedingParty.responsibleName)}</strong>
            </div>
            <div>
              <span>RG ou funcional</span>
              <strong>{displayText(concedingParty.responsibleDocument)}</strong>
            </div>
            <div>
              <span>Conselho profissional</span>
              <strong>{displayText(concedingParty.professionalCouncil)}</strong>
            </div>
            <div className="tce-preview-grid-wide">
              <span>Endereço</span>
              <strong>
                {displayText(
                  [
                    concedingParty.address,
                    concedingParty.addressNumber,
                    concedingParty.addressComplement,
                    concedingParty.neighborhood,
                    concedingParty.city,
                    concedingParty.state,
                    concedingParty.postalCode
                  ]
                    .filter((value) => typeof value === "string" && value.trim().length)
                    .join(" · ")
                )}
              </strong>
            </div>
            <div>
              <span>Telefone</span>
              <strong>{displayText(concedingParty.phone)}</strong>
            </div>
            <div>
              <span>E-mail</span>
              <strong>{displayText(concedingParty.email)}</strong>
            </div>
            <div className="tce-preview-grid-wide">
              <span>Local de estágio</span>
              <strong>
                {displayText(
                  [
                    concedingParty.internshipLocation,
                    concedingParty.internshipLocationAddress,
                    concedingParty.internshipLocationNumber,
                    concedingParty.internshipLocationComplement,
                    concedingParty.internshipLocationNeighborhood,
                    concedingParty.internshipLocationCity,
                    concedingParty.internshipLocationState,
                    concedingParty.internshipLocationPostalCode
                  ]
                    .filter((value) => typeof value === "string" && value.trim().length)
                    .join(" · ")
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Estagiário(a)</h3>
          <div className="tce-preview-grid">
            <div>
              <span>Nome</span>
              <strong>{displayText(draft.full_name)}</strong>
            </div>
            <div>
              <span>RA</span>
              <strong>{displayText(draft.registration)}</strong>
            </div>
            <div>
              <span>Campus/Polo</span>
              <strong>{displayText(draft.campus)}</strong>
            </div>
            <div>
              <span>Curso</span>
              <strong>{displayText(draft.course_name)}</strong>
            </div>
            <div>
              <span>Semestre</span>
              <strong>{displayText(draft.semester_label)}</strong>
            </div>
            <div>
              <span>Turno</span>
              <strong>{displayText(draft.shift)}</strong>
            </div>
            <div className="tce-preview-grid-wide">
              <span>Endereço</span>
              <strong>
                {displayText(
                  [
                    draft.address,
                    draft.address_number,
                    draft.address_complement,
                    draft.neighborhood,
                    draft.city,
                    draft.state,
                    draft.postal_code
                  ]
                    .filter((value) => value.trim().length)
                    .join(" · ")
                )}
              </strong>
            </div>
            <div>
              <span>Telefone</span>
              <strong>{displayText(draft.phone)}</strong>
            </div>
            <div>
              <span>E-mail</span>
              <strong>{displayText(draft.email)}</strong>
            </div>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Instituição de Ensino</h3>
          <div className="tce-preview-grid">
            <div>
              <span>Instituição</span>
              <strong>{displayText(entry.institutionName)}</strong>
            </div>
            <div>
              <span>Curso</span>
              <strong>{displayText(entry.courseName)}</strong>
            </div>
            <div>
              <span>Unidade</span>
              <strong>{displayText(entry.unitName)}</strong>
            </div>
            <div>
              <span>Área de estágio</span>
              <strong>{displayText(entry.areaName)}</strong>
            </div>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Vigência</h3>
          <div className="tce-preview-grid">
            <div>
              <span>Data inicial</span>
              <strong>{formatPreviewDate(termData.startsAt)}</strong>
            </div>
            <div>
              <span>Data final</span>
              <strong>{formatPreviewDate(termData.endsAt)}</strong>
            </div>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Horário</h3>
          <div className="table-wrap tce-preview-table-wrap">
            <table className="table tce-preview-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Horário</th>
                  <th>Intervalo</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => {
                  const day = scheduleData[row.key];

                  return (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{formatTimeRange(day)}</td>
                      <td>{formatBreakRange(day)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Jornada</h3>
          <div className="tce-preview-grid">
            <div>
              <span>Jornada diária</span>
              <strong>{displayText(entry.configuration.dailyWorkload)}</strong>
            </div>
            <div>
              <span>Jornada semanal</span>
              <strong>{displayText(entry.configuration.weeklyWorkload)}</strong>
            </div>
            <div>
              <span>Jornada semestral</span>
              <strong>{displayText(entry.configuration.semesterWorkload)}</strong>
            </div>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Cláusulas contratuais</h3>
          <div className="tce-preview-copy">
            <p>
              Esta prévia mantém os campos institucionais do estágio e será usada para
              compor o documento oficial no layout final da instituição.
            </p>
            <p>
              A jornada, a vigência, a área de atuação e o plano de atividades abaixo
              serão preservados na geração posterior do PDF.
            </p>
            <p>
              As assinaturas da Parte Concedente, do Estagiário(a) e da Instituição de
              Ensino permanecem reservadas para o documento impresso.
            </p>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Plano de Atividades de Estágio</h3>
          <div className="tce-preview-copy">
            <p>{displayText(entry.configuration.activityPlan)}</p>
          </div>
        </section>

        <section className="tce-preview-section">
          <h3>Cidade e data</h3>
          <p className="tce-preview-inline-copy">
            {displayText(entry.configuration.signatureCity)},{" "}
            {formatPreviewDate(entry.configuration.signatureDate)}
          </p>
        </section>

        <section className="tce-preview-section">
          <h3>Assinaturas</h3>
          <div className="tce-preview-signature-grid">
            <div className="tce-preview-signature-item">
              <span className="tce-preview-signature-line" />
              <strong>Parte Concedente</strong>
            </div>
            <div className="tce-preview-signature-item">
              <span className="tce-preview-signature-line" />
              <strong>Estagiário(a)</strong>
            </div>
            <div className="tce-preview-signature-item">
              <span className="tce-preview-signature-line" />
              <strong>Instituição de Ensino</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
