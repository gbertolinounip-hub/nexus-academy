import { SectionCard } from "@/components/common/section-card";
import { PatientAssignmentForm } from "@/components/forms/patient-assignment-form";
import { requireRole } from "@/lib/auth/session";
import { getClinicalCaseFormPageData } from "@/services/clinical-supervision";

export default async function NewClinicalCasePage(props: {
  searchParams?: Promise<{
    patient_id?: string;
  }>;
}) {
  const currentUser = await requireRole(["professor", "coordenador", "secretaria"]);
  const searchParams = (await props.searchParams) ?? {};
  const { formData, emptyState } = await getClinicalCaseFormPageData(currentUser, {
    patientId: searchParams.patient_id ?? null
  });

  if (!formData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Novo caso clínico</h1>
          <p>
            Cadastro-base do paciente e atribuição supervisionada ao estagiário
            selecionado.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Fluxo indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível montar o formulário clínico neste momento."
          }
        >
          <p className="empty-message">
            Assim que houver estagiários aptos no seu contexto institucional, o
            cadastro e a atribuição de paciente ficarão disponíveis aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Novo caso clínico</h1>
        <p>
          {formData.operator.role === "coordenador"
            ? "Reaproveite o cadastro-base do paciente, escolha o contexto correto de supervisão e configure os atendimentos semanais fixos do novo caso clínico."
            : formData.operator.role === "secretaria"
              ? "Reaproveite o cadastro-base do paciente, selecione a área de estágio, filtre o estagiário correto e configure os atendimentos semanais fixos do novo caso."
              : "Cadastre o paciente, escolha o estagiário correto e configure os atendimentos semanais fixos do caso clínico supervisionado."}
        </p>
      </section>

      <SectionCard
        title="Cadastro e atribuição de paciente"
        description="Estrutura atual para criar ou reaproveitar o cadastro-base do paciente, vinculá-lo ao estagiário supervisionado e definir a agenda semanal fixa."
      >
        <PatientAssignmentForm
          mode="create"
          studentOptions={formData.studentOptions}
          emptyHint={formData.emptyHint}
          initialValues={{
            case_id: formData.initialValues.caseId ?? "",
            patient_id: formData.initialValues.patientId,
            patient_identifier: formData.initialValues.patientIdentifier,
            patient_name: formData.initialValues.patientName,
            patient_birth_date: formData.initialValues.patientBirthDate,
            patient_cpf: formData.initialValues.patientCpf,
            patient_contact: formData.initialValues.patientContact,
            patient_companion: formData.initialValues.patientCompanion,
            enrollment_id: formData.initialValues.enrollmentId,
            schedules: formData.initialValues.schedules,
            status: formData.initialValues.status
          }}
        />
      </SectionCard>
    </div>
  );
}
