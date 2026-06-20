import type { TceStudentData } from "@/types/domain";

export interface StudentTceFormValues {
  configuration_id: string;
  enrollment_id: string;
  area_estagio_id: string;
  full_name: string;
  registration: string;
  campus: string;
  course_name: string;
  semester_label: string;
  shift: string;
  address: string;
  address_number: string;
  address_complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
}

export interface StudentTceActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: StudentTceFormValues;
  savedAt?: string | null;
  submittedAt?: number;
}

export interface StudentTcePdfActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  generatedAt?: string | null;
  submittedAt?: number;
}

function readText(value?: string | null) {
  return typeof value === "string" ? value : "";
}

export function createInitialStudentTceFormValues(
  input?: Partial<StudentTceFormValues>
): StudentTceFormValues {
  return {
    configuration_id: input?.configuration_id ?? "",
    enrollment_id: input?.enrollment_id ?? "",
    area_estagio_id: input?.area_estagio_id ?? "",
    full_name: input?.full_name ?? "",
    registration: input?.registration ?? "",
    campus: input?.campus ?? "",
    course_name: input?.course_name ?? "",
    semester_label: input?.semester_label ?? "",
    shift: input?.shift ?? "",
    address: input?.address ?? "",
    address_number: input?.address_number ?? "",
    address_complement: input?.address_complement ?? "",
    neighborhood: input?.neighborhood ?? "",
    city: input?.city ?? "",
    state: input?.state ?? "",
    postal_code: input?.postal_code ?? "",
    phone: input?.phone ?? "",
    email: input?.email ?? ""
  };
}

export function createStudentTceFormValuesFromData(input: {
  configurationId: string;
  enrollmentId: string;
  areaId: string;
  studentData: TceStudentData;
}): StudentTceFormValues {
  return createInitialStudentTceFormValues({
    configuration_id: input.configurationId,
    enrollment_id: input.enrollmentId,
    area_estagio_id: input.areaId,
    full_name: readText(input.studentData.fullName),
    registration: readText(input.studentData.registration),
    campus: readText(input.studentData.campus),
    course_name: readText(input.studentData.courseName),
    semester_label: readText(input.studentData.semesterLabel),
    shift: readText(input.studentData.shift),
    address: readText(input.studentData.address),
    address_number: readText(input.studentData.addressNumber),
    address_complement: readText(input.studentData.addressComplement),
    neighborhood: readText(input.studentData.neighborhood),
    city: readText(input.studentData.city),
    state: readText(input.studentData.state),
    postal_code: readText(input.studentData.postalCode),
    phone: readText(input.studentData.phone),
    email: readText(input.studentData.email)
  });
}

export const initialStudentTceActionState: StudentTceActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: createInitialStudentTceFormValues(),
  savedAt: null
};

export const initialStudentTcePdfActionState: StudentTcePdfActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  generatedAt: null
};

export function areStudentTceFormValuesEqual(
  left: StudentTceFormValues,
  right: StudentTceFormValues
) {
  return (
    left.configuration_id === right.configuration_id &&
    left.enrollment_id === right.enrollment_id &&
    left.area_estagio_id === right.area_estagio_id &&
    left.full_name === right.full_name &&
    left.registration === right.registration &&
    left.campus === right.campus &&
    left.course_name === right.course_name &&
    left.semester_label === right.semester_label &&
    left.shift === right.shift &&
    left.address === right.address &&
    left.address_number === right.address_number &&
    left.address_complement === right.address_complement &&
    left.neighborhood === right.neighborhood &&
    left.city === right.city &&
    left.state === right.state &&
    left.postal_code === right.postal_code &&
    left.phone === right.phone &&
    left.email === right.email
  );
}
