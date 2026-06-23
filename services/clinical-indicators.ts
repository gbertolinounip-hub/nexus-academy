import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { resolveScopedDataAccess } from "@/lib/auth/data-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatClinicalAttendanceEvolutionStatus,
  formatDate,
  formatDateTime,
  normalizeDateOnlyValue
} from "@/lib/utils/format";
import type { Database } from "@/types/database";
import type {
  ClinicalAttendanceEvolutionStatus,
  SessionUser
} from "@/types/domain";
import * as XLSX from "xlsx";

type ClinicalAttendanceRow =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Row"];
type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];

type ClinicalIndicatorsSupabaseClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const clinicalOpenEvolutionStatuses = [
  "pendente",
  "enviada",
  "ajustes_solicitados"
] as const satisfies ClinicalAttendanceEvolutionStatus[];

const clinicalEvolutionStatusOptions = [
  { value: "todos", label: "Todos os status" },
  { value: "pendente", label: formatClinicalAttendanceEvolutionStatus("pendente") },
  { value: "enviada", label: formatClinicalAttendanceEvolutionStatus("enviada") },
  {
    value: "ajustes_solicitados",
    label: formatClinicalAttendanceEvolutionStatus("ajustes_solicitados")
  },
  { value: "aprovada", label: formatClinicalAttendanceEvolutionStatus("aprovada") },
  { value: "reprovada", label: formatClinicalAttendanceEvolutionStatus("reprovada") },
  {
    value: "dispensada",
    label: formatClinicalAttendanceEvolutionStatus("dispensada")
  }
] as const;

interface EmptyState {
  title: string;
  description: string;
}

export type ClinicalAttendanceIndicatorsViewerRole =
  | "professor"
  | "coordenador"
  | "master_curso"
  | "coordenador_master";

export interface ClinicalAttendanceIndicatorsBreakdownRow {
  id: string;
  label: string;
  sublabel: string | null;
  attendancesPerformed: number;
  absentPatients: number;
  openEvolutions: number;
  sentForReview: number;
  adjustmentRequests: number;
  approvedEvolutions: number;
  reprovedEvolutions: number;
}

export interface ClinicalAttendanceIndicatorsPageData {
  viewerRole: ClinicalAttendanceIndicatorsViewerRole;
  viewerName: string;
  generatedAt: string;
  filters: {
    dateFrom: string;
    dateTo: string;
    institutionId: string;
    courseId: string;
    unitId: string;
    areaId: string;
    professorId: string;
    studentId: string;
    statusEvolucao: "todos" | ClinicalAttendanceEvolutionStatus;
  };
  visibility: {
    showInstitutionFilter: boolean;
    showCourseFilter: boolean;
    showUnitFilter: boolean;
    showProfessorFilter: boolean;
    showStudentFilter: boolean;
    showAreaFilter: boolean;
    showStatusFilter: boolean;
    showUnitBreakdown: boolean;
    showCourseBreakdown: boolean;
  };
  filterOptions: {
    institutions: Array<{ id: string; name: string }>;
    courses: Array<{ id: string; name: string; institutionId: string | null }>;
    units: Array<{
      id: string;
      name: string;
      institutionId: string | null;
      courseIds: string[];
    }>;
    areas: Array<{ id: string; name: string }>;
    professors: Array<{ id: string; name: string }>;
    students: Array<{ id: string; name: string; registration: string }>;
    statuses: Array<{
      value: "todos" | ClinicalAttendanceEvolutionStatus;
      label: string;
    }>;
  };
  metrics: {
    attendancesPerformed: number;
    absentPatients: number;
    openEvolutions: number;
    sentForReview: number;
    adjustmentRequests: number;
    approvedEvolutions: number;
    reprovedEvolutions: number;
  };
  breakdowns: {
    byArea: ClinicalAttendanceIndicatorsBreakdownRow[];
    byStudent: ClinicalAttendanceIndicatorsBreakdownRow[];
    byProfessor: ClinicalAttendanceIndicatorsBreakdownRow[];
    byUnit: ClinicalAttendanceIndicatorsBreakdownRow[];
    byCourse: ClinicalAttendanceIndicatorsBreakdownRow[];
  };
}

export interface ClinicalAttendanceIndicatorsLoadResult {
  pageData: ClinicalAttendanceIndicatorsPageData | null;
  emptyState: EmptyState | null;
}

interface ClinicalAttendanceIndicatorLookups {
  institutionNamesById: Map<string, string>;
  courseNamesById: Map<string, string>;
  unitNamesById: Map<string, string>;
  areaNamesById: Map<string, string>;
  professorNamesById: Map<string, string>;
  studentNamesById: Map<string, string>;
  studentRegistrationsById: Map<string, string>;
}

function buildEmptyState(title: string, description: string): EmptyState {
  return { title, description };
}

function sanitizeClinicalIndicatorsFileToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getMonthBounds(referenceDate: string) {
  const normalizedDate = normalizeDateOnlyValue(referenceDate) ?? getTodayInSaoPaulo();
  const [year, month] = normalizedDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0)).getUTCDate();

  return {
    start: `${year}-${padDatePart(month)}-01`,
    end: `${year}-${padDatePart(month)}-${padDatePart(lastDay)}`
  };
}

function normalizeClinicalIndicatorsDateRange(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const today = getTodayInSaoPaulo();
  const monthBounds = getMonthBounds(today);
  let dateFrom = normalizeDateOnlyValue(input.dateFrom) ?? monthBounds.start;
  let dateTo = normalizeDateOnlyValue(input.dateTo) ?? monthBounds.end;

  if (dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  return {
    dateFrom,
    dateTo
  };
}

function normalizeClinicalIndicatorsViewerRole(
  currentUser: SessionUser
): ClinicalAttendanceIndicatorsViewerRole | null {
  if (currentUser.role === "professor") {
    return "professor";
  }

  if (currentUser.role === "coordenador_master") {
    return "coordenador_master";
  }

  if (currentUser.role === "coordenador") {
    return getActiveMasterCourseContext(currentUser) ? "master_curso" : "coordenador";
  }

  return null;
}

function normalizeClinicalIndicatorsStatusFilter(
  value?: string | null
): "todos" | ClinicalAttendanceEvolutionStatus {
  if (
    value === "pendente" ||
    value === "enviada" ||
    value === "ajustes_solicitados" ||
    value === "aprovada" ||
    value === "reprovada" ||
    value === "dispensada"
  ) {
    return value;
  }

  return "todos";
}

function isClinicalOpenEvolutionStatus(value: ClinicalAttendanceEvolutionStatus) {
  return clinicalOpenEvolutionStatuses.includes(
    value as (typeof clinicalOpenEvolutionStatuses)[number]
  );
}

function createEmptyIndicatorMetricSummary() {
  return {
    attendancesPerformed: 0,
    absentPatients: 0,
    openEvolutions: 0,
    sentForReview: 0,
    adjustmentRequests: 0,
    approvedEvolutions: 0,
    reprovedEvolutions: 0
  };
}

function accumulateClinicalIndicatorMetrics(
  accumulator: ReturnType<typeof createEmptyIndicatorMetricSummary>,
  row: ClinicalAttendanceRow
) {
  if (row.status_presenca === "presente") {
    accumulator.attendancesPerformed += 1;
  }

  if (row.status_presenca === "ausente") {
    accumulator.absentPatients += 1;
  }

  if (
    row.status_presenca === "presente" &&
    isClinicalOpenEvolutionStatus(row.status_evolucao)
  ) {
    accumulator.openEvolutions += 1;
  }

  if (row.status_presenca === "presente" && row.status_evolucao === "enviada") {
    accumulator.sentForReview += 1;
  }

  if (
    row.status_presenca === "presente" &&
    row.status_evolucao === "ajustes_solicitados"
  ) {
    accumulator.adjustmentRequests += 1;
  }

  if (row.status_evolucao === "aprovada") {
    accumulator.approvedEvolutions += 1;
  }

  if (row.status_evolucao === "reprovada") {
    accumulator.reprovedEvolutions += 1;
  }
}

function createBreakdownRow(
  id: string,
  label: string,
  sublabel: string | null
): ClinicalAttendanceIndicatorsBreakdownRow {
  return {
    id,
    label,
    sublabel,
    ...createEmptyIndicatorMetricSummary()
  };
}

async function loadClinicalIndicatorLookupMaps(
  supabase: ClinicalIndicatorsSupabaseClient,
  rows: ClinicalAttendanceRow[]
): Promise<ClinicalAttendanceIndicatorLookups> {
  const institutionIds = uniqueStringValues(rows.map((row) => row.instituicao_id));
  const courseIds = uniqueStringValues(rows.map((row) => row.curso_id));
  const unitIds = uniqueStringValues(rows.map((row) => row.unidade_id));
  const areaIds = uniqueStringValues(rows.map((row) => row.area_estagio_id));
  const professorIds = uniqueStringValues(rows.map((row) => row.professor_id));
  const studentIds = uniqueStringValues(rows.map((row) => row.aluno_id));

  const [
    institutionResult,
    courseResult,
    unitResult,
    areaResult,
    professorResult,
    studentUsersResult,
    studentRowsResult
  ] = await Promise.all([
    institutionIds.length
      ? supabase.from("instituicoes").select("id, nome").in("id", institutionIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? supabase.from("cursos").select("id, nome, instituicao_id").in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase
          .from("unidades")
          .select("id, nome, instituicao_id")
          .in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    areaIds.length
      ? supabase.from("areas_estagio").select("id, nome").in("id", areaIds)
      : Promise.resolve({ data: [], error: null }),
    professorIds.length
      ? supabase.from("usuarios").select("id, nome_completo").in("id", professorIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("usuarios").select("id, nome_completo").in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("alunos").select("usuario_id, matricula").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    institutionResult.error ||
    courseResult.error ||
    unitResult.error ||
    areaResult.error ||
    professorResult.error ||
    studentUsersResult.error ||
    studentRowsResult.error
  ) {
    throw new Error("clinical-indicator-lookups-load-failed");
  }

  const institutionNamesById = new Map(
    ((institutionResult.data ?? []) as Pick<InstitutionRow, "id" | "nome">[]).map((row) => [
      row.id,
      row.nome
    ])
  );
  const courseNamesById = new Map(
    ((courseResult.data ?? []) as Pick<CourseRow, "id" | "nome">[]).map((row) => [
      row.id,
      row.nome
    ])
  );
  const unitNamesById = new Map(
    ((unitResult.data ?? []) as Pick<UnitRow, "id" | "nome">[]).map((row) => [
      row.id,
      row.nome
    ])
  );
  const areaNamesById = new Map(
    ((areaResult.data ?? []) as Pick<AreaRow, "id" | "nome">[]).map((row) => [
      row.id,
      row.nome
    ])
  );
  const professorNamesById = new Map(
    ((professorResult.data ?? []) as Pick<UserRow, "id" | "nome_completo">[]).map((row) => [
      row.id,
      row.nome_completo
    ])
  );
  const studentNamesById = new Map(
    ((studentUsersResult.data ?? []) as Pick<UserRow, "id" | "nome_completo">[]).map((row) => [
      row.id,
      row.nome_completo
    ])
  );
  const studentRegistrationsById = new Map(
    ((studentRowsResult.data ?? []) as Pick<StudentRow, "usuario_id" | "matricula">[]).map(
      (row) => [row.usuario_id, row.matricula]
    )
  );

  return {
    institutionNamesById,
    courseNamesById,
    unitNamesById,
    areaNamesById,
    professorNamesById,
    studentNamesById,
    studentRegistrationsById
  };
}

async function loadScopedAttendanceRows(input: {
  currentUser: SessionUser;
  dateFrom: string;
  dateTo: string;
}) {
  const serverSupabase = await createSupabaseServerClient();
  const supabase =
    input.currentUser.role === "coordenador_master"
      ? createSupabaseAdminClient()
      : serverSupabase;
  let query = supabase
    .from("atendimentos_clinicos")
    .select("*")
    .gte("data_atendimento", input.dateFrom)
    .lte("data_atendimento", input.dateTo)
    .order("data_atendimento", { ascending: false });

  if (input.currentUser.role === "professor") {
    query = query.eq("professor_id", input.currentUser.id);
    const { data, error } = await query;

    if (error) {
      throw new Error("clinical-attendance-indicators-load-failed");
    }

    return {
      rows: (data ?? []) as ClinicalAttendanceRow[],
      scopeKind: null
    };
  }

  if (input.currentUser.role === "coordenador") {
    const scope = await resolveScopedDataAccess(input.currentUser, {
      supabase
    });

    if (
      scope.scopeKind === "none" ||
      (scope.restrictToCourse && scope.offerIds.length === 0)
    ) {
      return {
        rows: [] as ClinicalAttendanceRow[],
        scopeKind: scope.scopeKind
      };
    }

    if (scope.offerIds.length > 0) {
      query = query.in("oferta_curso_unidade_id", scope.offerIds);
    } else if (scope.unitIds.length > 0) {
      query = query.in("unidade_id", scope.unitIds);
    } else if (scope.cursoId) {
      query = query.eq("curso_id", scope.cursoId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error("clinical-attendance-indicators-load-failed");
    }

    return {
      rows: (data ?? []) as ClinicalAttendanceRow[],
      scopeKind: scope.scopeKind
    };
  }

  if (input.currentUser.role === "coordenador_master") {
    const { data, error } = await query;

    if (error) {
      throw new Error("clinical-attendance-indicators-load-failed");
    }

    return {
      rows: (data ?? []) as ClinicalAttendanceRow[],
      scopeKind: "global_master" as const
    };
  }

  return {
    rows: [] as ClinicalAttendanceRow[],
    scopeKind: null
  };
}

function sortOptionRows<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function matchesOptionalFilter(rowValue: string | null, filterValue: string) {
  return filterValue ? rowValue === filterValue : true;
}

function buildBreakdownRows(
  rows: ClinicalAttendanceRow[],
  factory: (
    row: ClinicalAttendanceRow
  ) => { key: string; label: string; sublabel: string | null } | null
) {
  const byKey = new Map<string, ClinicalAttendanceIndicatorsBreakdownRow>();

  for (const row of rows) {
    const descriptor = factory(row);

    if (!descriptor) {
      continue;
    }

    const current =
      byKey.get(descriptor.key) ??
      createBreakdownRow(descriptor.key, descriptor.label, descriptor.sublabel);
    accumulateClinicalIndicatorMetrics(current, row);
    byKey.set(descriptor.key, current);
  }

  return [...byKey.values()].sort((left, right) => {
    if (right.attendancesPerformed !== left.attendancesPerformed) {
      return right.attendancesPerformed - left.attendancesPerformed;
    }

    if (right.openEvolutions !== left.openEvolutions) {
      return right.openEvolutions - left.openEvolutions;
    }

    return left.label.localeCompare(right.label, "pt-BR");
  });
}

function resolveClinicalIndicatorsViewerLabel(
  viewerRole: ClinicalAttendanceIndicatorsViewerRole
) {
  switch (viewerRole) {
    case "professor":
      return "Professor/supervisor";
    case "coordenador":
      return "Coordenador local";
    case "master_curso":
      return "Gestor/master-curso";
    case "coordenador_master":
      return "Master institucional";
    default:
      return viewerRole;
  }
}

function resolveClinicalIndicatorsSelectedOptionLabel(
  options: Array<{ id: string; name: string }>,
  value: string
) {
  if (!value) {
    return "Todos";
  }

  return options.find((option) => option.id === value)?.name ?? value;
}

function resolveClinicalIndicatorsSelectedStatusLabel(
  options: ClinicalAttendanceIndicatorsPageData["filterOptions"]["statuses"],
  value: ClinicalAttendanceIndicatorsPageData["filters"]["statusEvolucao"]
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function buildClinicalIndicatorsSheetRows(
  rows: ClinicalAttendanceIndicatorsBreakdownRow[]
) {
  if (!rows.length) {
    return [["Nenhum dado disponível para este recorte."]];
  }

  return rows.map((row) => [
    row.label,
    row.sublabel ?? "",
    row.attendancesPerformed,
    row.absentPatients,
    row.openEvolutions,
    row.sentForReview,
    row.adjustmentRequests,
    row.approvedEvolutions
  ]);
}

function applyClinicalIndicatorsSheetColumns(
  sheet: XLSX.WorkSheet,
  widths: number[]
) {
  sheet["!cols"] = widths.map((width) => ({ wch: width }));
}

export function getClinicalAttendanceIndicatorsFileBaseName(
  pageData: ClinicalAttendanceIndicatorsPageData
) {
  const roleToken = sanitizeClinicalIndicatorsFileToken(pageData.viewerRole);
  return `indicadores-clinicos-${roleToken}-${pageData.filters.dateFrom}-a-${pageData.filters.dateTo}`;
}

export function buildClinicalAttendanceIndicatorsWorkbook(
  pageData: ClinicalAttendanceIndicatorsPageData
) {
  const workbook = XLSX.utils.book_new();
  const filterSummaryRows = [
    ["Perfil", resolveClinicalIndicatorsViewerLabel(pageData.viewerRole)],
    ["Gerado em", formatDateTime(pageData.generatedAt)],
    ["Data inicial", formatDate(pageData.filters.dateFrom)],
    ["Data final", formatDate(pageData.filters.dateTo)],
    [
      "Instituição / IES",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.institutions,
        pageData.filters.institutionId
      )
    ],
    [
      "Curso",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.courses,
        pageData.filters.courseId
      )
    ],
    [
      "Unidade",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.units,
        pageData.filters.unitId
      )
    ],
    [
      "Área de estágio",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.areas,
        pageData.filters.areaId
      )
    ],
    [
      "Professor",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.professors,
        pageData.filters.professorId
      )
    ],
    [
      "Aluno",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.students.map((student) => ({
          id: student.id,
          name: `${student.name} · ${student.registration}`
        })),
        pageData.filters.studentId
      )
    ],
    [
      "Status da evolução",
      resolveClinicalIndicatorsSelectedStatusLabel(
        pageData.filterOptions.statuses,
        pageData.filters.statusEvolucao
      )
    ]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Indicadores clínicos"],
    [],
    ...filterSummaryRows,
    [],
    ["Indicador", "Valor"],
    ["Atendimentos realizados", pageData.metrics.attendancesPerformed],
    ["Pacientes ausentes", pageData.metrics.absentPatients],
    ["Evoluções pendentes", pageData.metrics.openEvolutions],
    ["Enviadas para revisão", pageData.metrics.sentForReview],
    ["Ajustes solicitados", pageData.metrics.adjustmentRequests],
    ["Evoluções aprovadas", pageData.metrics.approvedEvolutions],
    ["Evoluções reprovadas", pageData.metrics.reprovedEvolutions]
  ]);
  applyClinicalIndicatorsSheetColumns(summarySheet, [28, 42]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const breakdownHeader = [
    "Recorte",
    "Complemento",
    "Atendimentos realizados",
    "Pacientes ausentes",
    "Evoluções pendentes",
    "Enviadas para revisão",
    "Ajustes solicitados",
    "Evoluções aprovadas"
  ];
  const breakdownWidths = [34, 24, 16, 16, 18, 18, 18, 18];
  const appendBreakdownSheet = (
    name: string,
    rows: ClinicalAttendanceIndicatorsBreakdownRow[]
  ) => {
    const sheet = XLSX.utils.aoa_to_sheet([
      breakdownHeader,
      ...buildClinicalIndicatorsSheetRows(rows)
    ]);
    applyClinicalIndicatorsSheetColumns(sheet, breakdownWidths);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  appendBreakdownSheet("Por área", pageData.breakdowns.byArea);
  appendBreakdownSheet("Por aluno", pageData.breakdowns.byStudent);
  appendBreakdownSheet("Por professor", pageData.breakdowns.byProfessor);

  if (pageData.visibility.showUnitBreakdown) {
    appendBreakdownSheet("Por unidade", pageData.breakdowns.byUnit);
  }

  if (pageData.visibility.showCourseBreakdown) {
    appendBreakdownSheet("Por curso", pageData.breakdowns.byCourse);
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  }) as Buffer;
}

export async function getClinicalAttendanceIndicatorsPageData(
  currentUser: SessionUser,
  filters?: {
    dateFrom?: string | null;
    dateTo?: string | null;
    institutionId?: string | null;
    courseId?: string | null;
    unitId?: string | null;
    areaId?: string | null;
    professorId?: string | null;
    studentId?: string | null;
    statusEvolucao?: string | null;
  }
): Promise<ClinicalAttendanceIndicatorsLoadResult> {
  const viewerRole = normalizeClinicalIndicatorsViewerRole(currentUser);

  if (!viewerRole) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Indicadores clínicos indisponíveis para este perfil",
        "Nesta etapa, os indicadores da Clínica Supervisionada estão disponíveis apenas para professor, coordenação e Master."
      )
    };
  }

  const normalizedDates = normalizeClinicalIndicatorsDateRange({
    dateFrom: filters?.dateFrom ?? null,
    dateTo: filters?.dateTo ?? null
  });

  try {
    const { rows: scopedRows, scopeKind } = await loadScopedAttendanceRows({
      currentUser,
      dateFrom: normalizedDates.dateFrom,
      dateTo: normalizedDates.dateTo
    });

    if (
      currentUser.role === "coordenador" &&
      scopeKind === "none" &&
      scopedRows.length === 0
    ) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Escopo clínico não encontrado",
          "Não foi possível resolver um contexto institucional seguro para consolidar os indicadores clínicos."
        )
      };
    }

    const supabase =
      currentUser.role === "coordenador_master"
        ? createSupabaseAdminClient()
        : await createSupabaseServerClient();
    const lookups = await loadClinicalIndicatorLookupMaps(supabase, scopedRows);

    const institutionOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.instituicao_id))
        .map((id) => ({
          id,
          name: lookups.institutionNamesById.get(id) ?? "Instituição não identificada"
        }))
        .filter((item) => item.name.trim())
    );
    const courseOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.curso_id))
        .map((id) => ({
          id,
          name: lookups.courseNamesById.get(id) ?? "Curso não identificado",
          institutionId:
            scopedRows.find((row) => row.curso_id === id)?.instituicao_id ?? null
        }))
        .filter((item) => item.name.trim())
    );
    const unitOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.unidade_id))
        .map((id) => ({
          id,
          name: lookups.unitNamesById.get(id) ?? "Unidade não identificada",
          institutionId:
            scopedRows.find((row) => row.unidade_id === id)?.instituicao_id ?? null,
          courseIds: uniqueStringValues(
            scopedRows
              .filter((row) => row.unidade_id === id)
              .map((row) => row.curso_id)
          )
        }))
        .filter((item) => item.name.trim())
    );
    const areaOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.area_estagio_id))
        .map((id) => ({
          id,
          name: lookups.areaNamesById.get(id) ?? "Área não identificada"
        }))
        .filter((item) => item.name.trim())
    );
    const professorOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.professor_id))
        .map((id) => ({
          id,
          name: lookups.professorNamesById.get(id) ?? "Professor não identificado"
        }))
        .filter((item) => item.name.trim())
    );
    const studentOptions = sortOptionRows(
      uniqueStringValues(scopedRows.map((row) => row.aluno_id))
        .map((id) => ({
          id,
          name: lookups.studentNamesById.get(id) ?? "Aluno não identificado",
          registration: lookups.studentRegistrationsById.get(id) ?? "Sem matrícula"
        }))
        .filter((item) => item.name.trim())
    );

    const showInstitutionFilter = viewerRole === "coordenador_master";
    const showCourseFilter = viewerRole === "coordenador_master";
    const showUnitFilter =
      viewerRole === "coordenador_master" ||
      viewerRole === "master_curso" ||
      unitOptions.length > 1;
    const showProfessorFilter = viewerRole !== "professor";
    const showStudentFilter = true;
    const showAreaFilter = true;
    const showStatusFilter = true;
    const showUnitBreakdown =
      viewerRole === "coordenador_master" || viewerRole === "master_curso";
    const showCourseBreakdown = viewerRole === "coordenador_master";

    const normalizedInstitutionId =
      showInstitutionFilter &&
      institutionOptions.some((option) => option.id === filters?.institutionId)
        ? (filters?.institutionId ?? "")
        : "";
    const normalizedCourseId =
      showCourseFilter && courseOptions.some((option) => option.id === filters?.courseId)
        ? (filters?.courseId ?? "")
        : "";
    const normalizedUnitId =
      showUnitFilter && unitOptions.some((option) => option.id === filters?.unitId)
        ? (filters?.unitId ?? "")
        : "";
    const normalizedAreaId = areaOptions.some((option) => option.id === filters?.areaId)
      ? (filters?.areaId ?? "")
      : "";
    const normalizedProfessorId =
      showProfessorFilter &&
      professorOptions.some((option) => option.id === filters?.professorId)
        ? (filters?.professorId ?? "")
        : "";
    const normalizedStudentId = studentOptions.some((option) => option.id === filters?.studentId)
      ? (filters?.studentId ?? "")
      : "";
    const normalizedStatus = normalizeClinicalIndicatorsStatusFilter(
      filters?.statusEvolucao ?? null
    );

    const filteredRows = scopedRows.filter((row) => {
      if (!matchesOptionalFilter(row.instituicao_id, normalizedInstitutionId)) {
        return false;
      }

      if (!matchesOptionalFilter(row.curso_id, normalizedCourseId)) {
        return false;
      }

      if (!matchesOptionalFilter(row.unidade_id, normalizedUnitId)) {
        return false;
      }

      if (!matchesOptionalFilter(row.area_estagio_id, normalizedAreaId)) {
        return false;
      }

      if (!matchesOptionalFilter(row.professor_id, normalizedProfessorId)) {
        return false;
      }

      if (!matchesOptionalFilter(row.aluno_id, normalizedStudentId)) {
        return false;
      }

      if (normalizedStatus !== "todos" && row.status_evolucao !== normalizedStatus) {
        return false;
      }

      return true;
    });

    const metrics = createEmptyIndicatorMetricSummary();

    for (const row of filteredRows) {
      accumulateClinicalIndicatorMetrics(metrics, row);
    }

    const pageData: ClinicalAttendanceIndicatorsPageData = {
      viewerRole,
      viewerName: currentUser.name,
      generatedAt: new Date().toISOString(),
      filters: {
        dateFrom: normalizedDates.dateFrom,
        dateTo: normalizedDates.dateTo,
        institutionId: normalizedInstitutionId,
        courseId: normalizedCourseId,
        unitId: normalizedUnitId,
        areaId: normalizedAreaId,
        professorId: normalizedProfessorId,
        studentId: normalizedStudentId,
        statusEvolucao: normalizedStatus
      },
      visibility: {
        showInstitutionFilter,
        showCourseFilter,
        showUnitFilter,
        showProfessorFilter,
        showStudentFilter,
        showAreaFilter,
        showStatusFilter,
        showUnitBreakdown,
        showCourseBreakdown
      },
      filterOptions: {
        institutions: institutionOptions,
        courses: courseOptions,
        units: unitOptions,
        areas: areaOptions,
        professors: professorOptions,
        students: studentOptions,
        statuses: clinicalEvolutionStatusOptions.map((option) => ({
          value: option.value,
          label: option.label
        }))
      },
      metrics,
      breakdowns: {
        byArea: buildBreakdownRows(filteredRows, (row) => {
          const areaId = row.area_estagio_id;

          if (!areaId) {
            return null;
          }

          return {
            key: areaId,
            label: lookups.areaNamesById.get(areaId) ?? "Área não identificada",
            sublabel: null
          };
        }),
        byStudent: buildBreakdownRows(filteredRows, (row) => {
          const studentId = row.aluno_id;

          if (!studentId) {
            return null;
          }

          return {
            key: studentId,
            label: lookups.studentNamesById.get(studentId) ?? "Aluno não identificado",
            sublabel: lookups.studentRegistrationsById.get(studentId) ?? null
          };
        }),
        byProfessor: buildBreakdownRows(filteredRows, (row) => {
          const professorId = row.professor_id;

          if (!professorId) {
            return null;
          }

          return {
            key: professorId,
            label:
              lookups.professorNamesById.get(professorId) ?? "Professor não identificado",
            sublabel: null
          };
        }),
        byUnit: buildBreakdownRows(filteredRows, (row) => {
          const unitId = row.unidade_id;

          if (!unitId) {
            return null;
          }

          return {
            key: unitId,
            label: lookups.unitNamesById.get(unitId) ?? "Unidade não identificada",
            sublabel: row.curso_id
              ? (lookups.courseNamesById.get(row.curso_id) ?? null)
              : null
          };
        }),
        byCourse: buildBreakdownRows(filteredRows, (row) => {
          const courseId = row.curso_id;

          if (!courseId) {
            return null;
          }

          return {
            key: courseId,
            label: lookups.courseNamesById.get(courseId) ?? "Curso não identificado",
            sublabel: row.instituicao_id
              ? (lookups.institutionNamesById.get(row.instituicao_id) ?? null)
              : null
          };
        })
      }
    };

    return {
      pageData,
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar os indicadores clínicos",
        "Houve um problema ao consolidar as contagens de atendimentos realizados, ausências e evoluções da Clínica Supervisionada."
      )
    };
  }
}
