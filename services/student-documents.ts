import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveScopedDataAccess } from "@/lib/auth/data-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatStudentDocumentReviewerRole,
  formatStudentDocumentStatus,
  formatStudentDocumentType
} from "@/lib/utils/format";
import type { Database } from "@/types/database";
import type {
  SessionUser,
  StudentDocumentAreaOption,
  StudentDocumentNotificationCenter,
  StudentDocumentNotificationSummary,
  StudentDocumentNotificationType,
  StudentDocumentReviewerRole,
  StudentDocumentStatus,
  StudentDocumentSummary,
  StudentDocumentType
} from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documentos_aluno"]["Row"];
type DocumentNotificationRow =
  Database["public"]["Tables"]["notificacoes_documentos_aluno"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type ProfessorLinkRow =
  Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type DocumentTypeRow = Database["public"]["Tables"]["tipos_documento"]["Row"];
type RequiredCourseDocumentRow =
  Database["public"]["Tables"]["documentos_obrigatorios_curso"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type StudentDocumentReadClient = SupabaseServerClient | SupabaseAdminClient;

export const STUDENT_DOCUMENTS_BUCKET = "student-documents";
const STUDENT_DOCUMENTS_S3_SCHEME = "s3://";
export const STUDENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STUDENT_DOCUMENT_ACCEPTED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png"
] as const;
export const STUDENT_DOCUMENT_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png"
] as const;

const STUDENT_DOCUMENT_TYPE_COMPATIBILITY_CODES = {
  carteira_vacinacao: ["CARTEIRA_VACINACAO", "carteira_vacinacao"],
  tce: ["TCE", "tce"]
} as const satisfies Record<StudentDocumentType, readonly string[]>;

interface ResolvedStudentDocumentUploadContext {
  student: StudentRow;
  enrollment: EnrollmentRow | null;
  classRow: ClassRow | null;
  semester: SemesterRow | null;
  offer: OfferRow;
  requiredCourseDocument: RequiredCourseDocumentRow;
}

interface ResolvedStudentDocumentReviewContext {
  document: DocumentRow;
  student: StudentRow | null;
  enrollment: EnrollmentRow | null;
  classRow: ClassRow | null;
  semester: SemesterRow | null;
  offer: OfferRow | null;
  requiredCourseDocument: RequiredCourseDocumentRow | null;
  resolvedOfferId: string | null;
  resolvedCourseId: string | null;
  resolvedUnitId: string | null;
  resolvedInstitutionId: string | null;
}

interface StudentDocumentsS3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let studentDocumentsS3Client: S3Client | null = null;
let studentDocumentsS3ClientSignature: string | null = null;

function getStudentDocumentsS3Config(): StudentDocumentsS3Config {
  const region = process.env.AWS_REGION?.trim() ?? "";
  const bucket = process.env.AWS_S3_BUCKET?.trim() ?? "";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "As variáveis AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY devem estar configuradas para o upload de documentos."
    );
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey
  };
}

function getStudentDocumentsS3Client() {
  const config = getStudentDocumentsS3Config();
  const signature = `${config.region}:${config.bucket}:${config.accessKeyId}`;

  if (studentDocumentsS3Client && studentDocumentsS3ClientSignature === signature) {
    return studentDocumentsS3Client;
  }

  studentDocumentsS3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  studentDocumentsS3ClientSignature = signature;

  return studentDocumentsS3Client;
}

function isS3StudentDocumentStoragePath(storagePath: string) {
  return storagePath.startsWith(STUDENT_DOCUMENTS_S3_SCHEME);
}

function parseS3StudentDocumentStoragePath(storagePath: string) {
  if (!isS3StudentDocumentStoragePath(storagePath)) {
    return null;
  }

  const normalizedPath = storagePath.slice(STUDENT_DOCUMENTS_S3_SCHEME.length);
  const firstSlashIndex = normalizedPath.indexOf("/");

  if (firstSlashIndex <= 0) {
    return null;
  }

  return {
    bucket: normalizedPath.slice(0, firstSlashIndex),
    key: normalizedPath.slice(firstSlashIndex + 1)
  };
}

function buildPersistedS3StudentDocumentStoragePath(storageKey: string) {
  const { bucket } = getStudentDocumentsS3Config();
  return `${STUDENT_DOCUMENTS_S3_SCHEME}${bucket}/${storageKey}`;
}

function buildInlineDownloadDisposition(fileName: string) {
  const fallbackName = normalizeStorageFileName(fileName).replace(/"/g, "");
  const encodedName = encodeURIComponent(fileName);

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function normalizeStorageSegment(
  value: string | null | undefined,
  fallback: string,
  maxLength = 48
) {
  const normalizedValue = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return normalizedValue || fallback;
}

function normalizeStorageFileName(fileName: string) {
  const trimmedFileName = fileName.trim();
  const extensionMatch = trimmedFileName.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? "";
  const baseName = extension
    ? trimmedFileName.slice(0, -extension.length - 1)
    : trimmedFileName;
  const normalizedBaseName = normalizeStorageSegment(baseName, "documento", 80);

  return extension ? `${normalizedBaseName}.${extension}` : normalizedBaseName;
}

export function buildStudentDocumentStoragePath(input: {
  unitId: string;
  studentId: string;
  documentId: string;
  documentType: StudentDocumentType;
  fileName: string;
  enrollmentId?: string | null;
  areaName?: string | null;
  blockName?: string | null;
}) {
  const normalizedFileName = normalizeStorageFileName(input.fileName);
  const baseSegments = [
    "unidade",
    input.unitId,
    "aluno",
    input.studentId
  ];

  if (input.documentType === "carteira_vacinacao") {
    return [
      ...baseSegments,
      "carteira-vacinacao",
      `${input.documentId}-${normalizedFileName}`
    ].join("/");
  }

  const tceContextSegment = [
    `matricula-${input.enrollmentId ?? "sem-matricula"}`,
    `bloco-${normalizeStorageSegment(input.blockName, "sem-bloco")}`,
    `area-${normalizeStorageSegment(input.areaName, "sem-area")}`
  ].join("__");

  return [
    ...baseSegments,
    "tce",
    tceContextSegment,
    `${input.documentId}-${normalizedFileName}`
  ].join("/");
}

export function buildStudentDocumentS3StoragePath(input: {
  unitId: string;
  studentId: string;
  documentId: string;
  documentType: StudentDocumentType;
  fileName: string;
  enrollmentId?: string | null;
  areaName?: string | null;
  blockName?: string | null;
}) {
  return buildPersistedS3StudentDocumentStoragePath(
    buildStudentDocumentStoragePath(input)
  );
}

export async function uploadStudentDocumentBinary(input: {
  storagePath: string;
  fileBuffer: Buffer;
  contentType: string;
}) {
  if (!isS3StudentDocumentStoragePath(input.storagePath)) {
    throw new Error(
      "Novos uploads de documentos do aluno devem usar um storage_path S3 válido."
    );
  }

  const location = parseS3StudentDocumentStoragePath(input.storagePath);

  if (!location) {
    throw new Error("O caminho S3 do documento é inválido para upload.");
  }

  const s3Client = getStudentDocumentsS3Client();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: location.bucket,
      Key: location.key,
      Body: input.fileBuffer,
      ContentType: input.contentType
    })
  );
}

export async function removeStudentDocumentBinary(storagePath: string) {
  if (isS3StudentDocumentStoragePath(storagePath)) {
    const location = parseS3StudentDocumentStoragePath(storagePath);

    if (!location) {
      return;
    }

    const s3Client = getStudentDocumentsS3Client();
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: location.bucket,
        Key: location.key
      })
    );

    return;
  }

  const adminClient = createSupabaseAdminClient();
  await adminClient.storage.from(STUDENT_DOCUMENTS_BUCKET).remove([storagePath]);
}

async function loadOfferRowById(
  client: StudentDocumentReadClient,
  offerId: string
) {
  const { data, error } = await client
    .from("ofertas_curso_unidade")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Nao foi possivel carregar a oferta do curso vinculada ao documento."
    );
  }

  return (data ?? null) as OfferRow | null;
}

async function loadEnrollmentOfferContext(
  client: StudentDocumentReadClient,
  enrollment: EnrollmentRow
) {
  let classRow: ClassRow | null = null;
  let semester: SemesterRow | null = null;
  let offerId = enrollment.oferta_curso_unidade_id ?? null;

  if (!offerId) {
    const { data: classRowData, error: classRowError } = await client
      .from("turmas")
      .select("*")
      .eq("id", enrollment.turma_id)
      .maybeSingle();

    if (classRowError) {
      throw new Error(
        "Nao foi possivel consultar a turma vinculada ao documento do aluno."
      );
    }

    classRow = (classRowData ?? null) as ClassRow | null;
    offerId = classRow?.oferta_curso_unidade_id ?? null;

    if (!offerId && classRow?.semestre_id) {
      const { data: semesterData, error: semesterError } = await client
        .from("semestres")
        .select("*")
        .eq("id", classRow.semestre_id)
        .maybeSingle();

      if (semesterError) {
        throw new Error(
          "Nao foi possivel consultar o semestre vinculado ao documento do aluno."
        );
      }

      semester = (semesterData ?? null) as SemesterRow | null;
      offerId = semester?.oferta_curso_unidade_id ?? null;
    }
  }

  return {
    classRow,
    semester,
    offer: offerId ? await loadOfferRowById(client, offerId) : null
  };
}

async function loadRequiredCourseDocumentForType(
  client: StudentDocumentReadClient,
  courseId: string,
  documentType: StudentDocumentType
) {
  const compatibilityCodes = STUDENT_DOCUMENT_TYPE_COMPATIBILITY_CODES[documentType];
  const { data: documentTypeRowsData, error: documentTypeRowsError } = await client
    .from("tipos_documento")
    .select("*")
    .in("codigo", [...compatibilityCodes])
    .eq("ativo", true);

  if (documentTypeRowsError) {
    throw new Error(
      "Nao foi possivel carregar a configuracao dos tipos documentais do curso."
    );
  }

  const documentTypeRows = (documentTypeRowsData ?? []) as DocumentTypeRow[];

  if (!documentTypeRows.length) {
    return {
      requiredCourseDocument: null,
      hasAmbiguity: false
    } as const;
  }

  const { data: requiredCourseDocumentRowsData, error: requiredCourseDocumentRowsError } =
    await client
      .from("documentos_obrigatorios_curso")
      .select("*")
      .eq("curso_id", courseId)
      .eq("ativo", true)
      .eq("obrigatorio", true)
      .in(
        "tipo_documento_id",
        documentTypeRows.map((row) => row.id)
      )
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });

  if (requiredCourseDocumentRowsError) {
    throw new Error(
      "Nao foi possivel carregar os documentos obrigatorios configurados para o curso."
    );
  }

  const requiredCourseDocuments =
    (requiredCourseDocumentRowsData ?? []) as RequiredCourseDocumentRow[];

  return {
    requiredCourseDocument:
      requiredCourseDocuments.length === 1 ? requiredCourseDocuments[0] : null,
    hasAmbiguity: requiredCourseDocuments.length > 1
  } as const;
}

export async function resolveStudentDocumentUploadContext(input: {
  currentUser: SessionUser;
  documentType: StudentDocumentType;
  enrollmentId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: studentRowData, error: studentRowError } = await supabase
    .from("alunos")
    .select("*")
    .eq("usuario_id", input.currentUser.id)
    .maybeSingle();

  if (studentRowError) {
    throw new Error(
      "Nao foi possivel localizar o cadastro academico do aluno para este envio."
    );
  }

  const student = (studentRowData ?? null) as StudentRow | null;

  if (!student) {
    throw new Error(
      "Nao foi possivel localizar o cadastro academico do aluno para este envio."
    );
  }

  let enrollment: EnrollmentRow | null = null;
  let classRow: ClassRow | null = null;
  let semester: SemesterRow | null = null;
  let offer: OfferRow | null = null;

  if (input.enrollmentId) {
    const { data: enrollmentRowData, error: enrollmentRowError } = await supabase
      .from("matriculas_turma")
      .select("*")
      .eq("id", input.enrollmentId)
      .eq("aluno_id", input.currentUser.id)
      .maybeSingle();

    if (enrollmentRowError || !enrollmentRowData) {
      throw new Error(
        "Nao foi possivel identificar a matricula vinculada a este documento. Procure a coordenacao."
      );
    }

    enrollment = enrollmentRowData as EnrollmentRow;

    const enrollmentOfferContext = await loadEnrollmentOfferContext(
      supabase,
      enrollment
    );
    classRow = enrollmentOfferContext.classRow;
    semester = enrollmentOfferContext.semester;
    offer = enrollmentOfferContext.offer;

    if (!offer) {
      throw new Error(
        "Nao foi possivel identificar a oferta do curso vinculada a este documento. Procure a coordenacao."
      );
    }
  } else {
    const fallbackOfferIds = uniqueStringValues([
      student.oferta_curso_unidade_id,
      input.currentUser.contextoAtivo?.ofertaCursoUnidadeId ?? null,
      input.currentUser.ofertaCursoUnidadeId ?? null
    ]);

    if (fallbackOfferIds.length !== 1) {
      throw new Error(
        "Nao foi possivel identificar a oferta do curso vinculada a este documento. Procure a coordenacao."
      );
    }

    offer = await loadOfferRowById(supabase, fallbackOfferIds[0]);

    if (!offer) {
      throw new Error(
        "Nao foi possivel identificar a oferta do curso vinculada a este documento. Procure a coordenacao."
      );
    }
  }

  const requiredCourseDocumentResolution =
    await loadRequiredCourseDocumentForType(
      supabase,
      offer.curso_id,
      input.documentType
    );

  if (requiredCourseDocumentResolution.hasAmbiguity) {
    throw new Error(
      "Foi encontrada mais de uma configuracao obrigatoria ativa para este tipo de documento no curso. Procure a coordenacao."
    );
  }

  if (!requiredCourseDocumentResolution.requiredCourseDocument) {
    throw new Error(
      "Este documento ainda nao esta configurado como obrigatorio para o curso. Procure a coordenacao."
    );
  }

  return {
    student,
    enrollment,
    classRow,
    semester,
    offer,
    requiredCourseDocument:
      requiredCourseDocumentResolution.requiredCourseDocument
  } satisfies ResolvedStudentDocumentUploadContext;
}

async function resolveStudentDocumentReviewContext(documentId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: documentRowData, error: documentRowError } = await adminClient
    .from("documentos_aluno")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (documentRowError) {
    throw new Error(
      "Nao foi possivel localizar o documento solicitado para validacao."
    );
  }

  const document = (documentRowData ?? null) as DocumentRow | null;

  if (!document) {
    return null;
  }

  const [
    studentRowResult,
    enrollmentRowResult,
    requiredCourseDocumentResult
  ] = await Promise.all([
    adminClient
      .from("alunos")
      .select("*")
      .eq("usuario_id", document.aluno_id)
      .maybeSingle(),
    document.matricula_turma_id
      ? adminClient
          .from("matriculas_turma")
          .select("*")
          .eq("id", document.matricula_turma_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.documento_obrigatorio_curso_id
      ? adminClient
          .from("documentos_obrigatorios_curso")
          .select("*")
          .eq("id", document.documento_obrigatorio_curso_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (
    studentRowResult.error ||
    enrollmentRowResult.error ||
    requiredCourseDocumentResult.error
  ) {
    throw new Error(
      "Nao foi possivel carregar o contexto institucional do documento selecionado."
    );
  }

  const student = (studentRowResult.data ?? null) as StudentRow | null;
  const enrollment = (enrollmentRowResult.data ?? null) as EnrollmentRow | null;
  const requiredCourseDocument = (requiredCourseDocumentResult.data ?? null) as
    | RequiredCourseDocumentRow
    | null;

  let classRow: ClassRow | null = null;
  let semester: SemesterRow | null = null;
  let offer: OfferRow | null = null;

  if (document.oferta_curso_unidade_id) {
    offer = await loadOfferRowById(adminClient, document.oferta_curso_unidade_id);
  } else if (enrollment) {
    const enrollmentOfferContext = await loadEnrollmentOfferContext(
      adminClient,
      enrollment
    );
    classRow = enrollmentOfferContext.classRow;
    semester = enrollmentOfferContext.semester;
    offer = enrollmentOfferContext.offer;
  } else if (student?.oferta_curso_unidade_id) {
    offer = await loadOfferRowById(adminClient, student.oferta_curso_unidade_id);
  }

  return {
    document,
    student,
    enrollment,
    classRow,
    semester,
    offer,
    requiredCourseDocument,
    resolvedOfferId: offer?.id ?? document.oferta_curso_unidade_id ?? student?.oferta_curso_unidade_id ?? null,
    resolvedCourseId:
      offer?.curso_id ?? requiredCourseDocument?.curso_id ?? student?.curso_id ?? null,
    resolvedUnitId:
      offer?.unidade_id ?? document.unidade_id ?? student?.unidade_id ?? null,
    resolvedInstitutionId: offer?.instituicao_id ?? null
  } satisfies ResolvedStudentDocumentReviewContext;
}

function canCoordinatorReviewResolvedDocument(
  scope: Awaited<ReturnType<typeof resolveScopedDataAccess>>,
  context: ResolvedStudentDocumentReviewContext
) {
  if (scope.isGlobalMaster) {
    return true;
  }

  if (scope.scopeKind === "none") {
    return false;
  }

  const courseId = context.resolvedCourseId ?? context.student?.curso_id ?? null;
  const unitId = context.resolvedUnitId ?? context.student?.unidade_id ?? null;
  const offerId = context.resolvedOfferId;

  if (scope.scopeKind === "course_manager") {
    if (!scope.cursoId || courseId !== scope.cursoId) {
      return false;
    }

    if (
      scope.instituicaoId &&
      context.resolvedInstitutionId &&
      context.resolvedInstitutionId !== scope.instituicaoId
    ) {
      return false;
    }

    if (offerId && scope.offerIds.length > 0) {
      return scope.offerIds.includes(offerId);
    }

    if (unitId && scope.unitIds.length > 0) {
      return scope.unitIds.includes(unitId);
    }

    return false;
  }

  if (
    scope.restrictToCourse &&
    scope.cursoId &&
    courseId !== scope.cursoId
  ) {
    return false;
  }

  if (offerId && scope.offerIds.length > 0) {
    return scope.offerIds.includes(offerId);
  }

  if (unitId && scope.unitIds.length > 0) {
    return scope.unitIds.includes(unitId);
  }

  return false;
}

export async function assertCanReviewStudentDocument(
  currentUser: SessionUser,
  documentId: string
) {
  const context = await resolveStudentDocumentReviewContext(documentId);

  if (!context) {
    throw new Error(
      "O documento solicitado nao esta disponivel para esta validacao."
    );
  }

  if (currentUser.role === "professor") {
    const visibleStudentIds = await loadProfessorStudentIds(currentUser);

    if (!visibleStudentIds.includes(context.document.aluno_id)) {
      throw new Error(
        "Voce nao tem permissao para revisar este documento no contexto atual."
      );
    }

    return context;
  }

  if (currentUser.role === "coordenador") {
    const supabase = await createSupabaseServerClient();
    const scope = await resolveScopedDataAccess(currentUser, {
      supabase
    });

    if (!canCoordinatorReviewResolvedDocument(scope, context)) {
      throw new Error(
        "Voce nao tem permissao para revisar este documento no contexto atual."
      );
    }

    return context;
  }

  throw new Error(
    "Voce nao tem permissao para revisar este documento no contexto atual."
  );
}

async function buildStudentDocumentDownloadUrl(input: {
  storagePath: string;
  fileName: string;
}) {
  if (isS3StudentDocumentStoragePath(input.storagePath)) {
    const location = parseS3StudentDocumentStoragePath(input.storagePath);

    if (!location) {
      return null;
    }

    const s3Client = getStudentDocumentsS3Client();
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: location.bucket,
        Key: location.key,
        ResponseContentDisposition: buildInlineDownloadDisposition(input.fileName)
      }),
      {
        expiresIn: 60
      }
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .createSignedUrl(input.storagePath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

const DIRECTORY_STATUS_FILTERS = [
  { value: "todos", label: "Todos os status" },
  { value: "enviado", label: "Enviados" },
  { value: "aprovado", label: "Aprovados" },
  { value: "reprovado", label: "Reprovados" },
  { value: "sem_documentos", label: "Sem documentos" }
] as const;

type DirectoryStatusFilter = (typeof DIRECTORY_STATUS_FILTERS)[number]["value"];
type InstitutionalViewerRole = "professor" | "coordenador" | "coordenador_master";

export interface StudentDocumentsPageData {
  student: {
    id: string;
    name: string;
    registration: string;
    email: string;
    unitName: string | null;
  };
  vaccinationCurrent: StudentDocumentSummary | null;
  vaccinationHistory: StudentDocumentSummary[];
  tceOptions: StudentDocumentAreaOption[];
  tceDocuments: StudentDocumentSummary[];
  notifications: StudentDocumentNotificationCenter;
}

export interface StudentDocumentDirectoryFilterOption {
  value: string;
  label: string;
}

export interface StudentDocumentDirectoryInstitutionOption {
  id: string;
  name: string;
}

export interface StudentDocumentDirectoryUnitOption {
  value: string;
  label: string;
  institutionId: string | null;
}

export interface StudentDocumentDirectoryEntry {
  studentId: string;
  studentName: string;
  registration: string;
  email: string;
  institutionId: string | null;
  unitId: string | null;
  unitName: string | null;
  active: boolean;
  areaIds: string[];
  areaLabels: string[];
  currentVaccination: StudentDocumentSummary | null;
  currentTces: StudentDocumentSummary[];
  totalDocuments: number;
  pendingCount: number;
  rejectedCount: number;
  unreadNotificationCount: number;
  latestDocumentAt: string | null;
}

export interface StudentDocumentDirectoryPageData {
  viewerRole: InstitutionalViewerRole;
  title: string;
  description: string;
  filters: {
    search: string;
    institutionId: string;
    areaId: string;
    status: DirectoryStatusFilter;
    unitId: string;
  };
  institutionOptions: StudentDocumentDirectoryInstitutionOption[];
  areaOptions: StudentDocumentDirectoryFilterOption[];
  unitOptions: StudentDocumentDirectoryUnitOption[];
  statusOptions: ReadonlyArray<StudentDocumentDirectoryFilterOption>;
  metrics: {
    totalStudents: number;
    withPendingDocuments: number;
    withRejectedDocuments: number;
    withUnreadNotifications: number;
  };
  entries: StudentDocumentDirectoryEntry[];
}

export interface StudentDocumentDetailPageData {
  viewerRole: InstitutionalViewerRole;
  canReview: boolean;
  student: {
    id: string;
    name: string;
    registration: string;
    email: string;
    unitName: string | null;
    active: boolean;
    areaLabels: string[];
  };
  vaccinationDocuments: StudentDocumentSummary[];
  tceDocuments: StudentDocumentSummary[];
}

interface StudentDocumentScopeContext {
  users: UserRow[];
  students: StudentRow[];
  units: UnitRow[];
  documents: DocumentRow[];
  notifications: DocumentNotificationRow[];
  enrollments: EnrollmentRow[];
  classes: ClassRow[];
  semesters: SemesterRow[];
  areas: AreaRow[];
  blocks: BlockRow[];
  professorLinks: ProfessorLinkRow[];
}

interface StudentDocumentStudentScope {
  studentIds: string[];
  scope: Awaited<ReturnType<typeof resolveScopedDataAccess>> | null;
}

function normalizeSearchTerm(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}

function selectMostRecentTimestamp(values: Array<string | null | undefined>) {
  const validValues = values.filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (!validValues.length) {
    return null;
  }

  return [...validValues].sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function buildDirectoryStatusOptions(): StudentDocumentDirectoryFilterOption[] {
  return DIRECTORY_STATUS_FILTERS.map((option) => ({
    value: option.value,
    label: option.label
  }));
}

function buildDocumentNotificationActionLabel(type: StudentDocumentNotificationType) {
  switch (type) {
    case "documento_reprovado_coordenador":
      return "Correção solicitada pela coordenação";
    default:
      return "Correção solicitada pelo professor";
  }
}

function buildDocumentNotificationTitle(type: StudentDocumentNotificationType) {
  switch (type) {
    case "documento_reprovado_coordenador":
      return "Documento reprovado pela coordenação";
    default:
      return "Documento reprovado pelo professor";
  }
}

function buildDocumentNotificationMessage(input: {
  type: StudentDocumentNotificationType;
  documentType: StudentDocumentType;
  areaName: string | null;
  rejectionReason: string | null;
}) {
  const documentLabel = formatStudentDocumentType(input.documentType);
  const areaLabel = input.areaName ? ` em ${input.areaName}` : "";
  const prefix =
    input.type === "documento_reprovado_coordenador"
      ? "A coordenação reprovou"
      : "O professor supervisor reprovou";

  if (input.rejectionReason) {
    return `${prefix.toLowerCase()} sua ${documentLabel.toLowerCase()}${areaLabel}. Verifique a justificativa e envie uma nova versão.`;
  }

  return `${prefix} sua ${documentLabel.toLowerCase()}${areaLabel}. Verifique a justificativa e envie uma nova versão.`;
}

function buildStudentDocumentSummaryMaps(context: StudentDocumentScopeContext) {
  const userMap = new Map(context.users.map((row) => [row.id, row]));
  const studentMap = new Map(context.students.map((row) => [row.usuario_id, row]));
  const unitMap = new Map(context.units.map((row) => [row.id, row]));
  const enrollmentMap = new Map(context.enrollments.map((row) => [row.id, row]));
  const classMap = new Map(context.classes.map((row) => [row.id, row]));
  const semesterMap = new Map(context.semesters.map((row) => [row.id, row]));
  const areaMap = new Map(context.areas.map((row) => [row.id, row]));
  const blockMap = new Map(context.blocks.map((row) => [row.id, row]));

  function toSummary(row: DocumentRow): StudentDocumentSummary {
    const studentUser = userMap.get(row.aluno_id) ?? null;
    const studentProfile = studentMap.get(row.aluno_id) ?? null;
    const reviewerUser = row.validado_por ? userMap.get(row.validado_por) ?? null : null;
    const unit = row.unidade_id ? unitMap.get(row.unidade_id) ?? null : null;
    const enrollment = row.matricula_turma_id
      ? enrollmentMap.get(row.matricula_turma_id) ?? null
      : null;
    const classGroup = enrollment ? classMap.get(enrollment.turma_id) ?? null : null;
    const semester = classGroup ? semesterMap.get(classGroup.semestre_id) ?? null : null;
    const area = row.area_estagio_id ? areaMap.get(row.area_estagio_id) ?? null : null;
    const block = area ? blockMap.get(area.bloco_id) ?? null : null;
    const reviewerRole = row.validado_por_papel as StudentDocumentReviewerRole | null;

    return {
      id: row.id,
      unitId: row.unidade_id,
      unitName: unit?.nome ?? null,
      studentId: row.aluno_id,
      studentName: studentUser?.nome_completo ?? "Aluno não identificado",
      registration: studentProfile?.matricula ?? "Sem matrícula",
      type: row.tipo as StudentDocumentType,
      typeLabel: formatStudentDocumentType(row.tipo),
      status: row.status as StudentDocumentStatus,
      statusLabel: formatStudentDocumentStatus(row.status, reviewerRole),
      reviewerRole,
      reviewerRoleLabel: formatStudentDocumentReviewerRole(reviewerRole),
      reviewedByName: reviewerUser?.nome_completo ?? null,
      fileName: row.arquivo_nome,
      fileMimeType: row.arquivo_mime_type,
      fileSizeBytes: row.arquivo_tamanho_bytes,
      storagePath: row.storage_path,
      active: row.ativo,
      version: row.versao,
      previousDocumentId: row.documento_anterior_id,
      rejectionReason: row.observacao_validacao,
      submittedAt: row.enviado_em,
      reviewedAt: row.validado_em,
      createdAt: row.created_at,
      areaId: row.area_estagio_id,
      areaName: area?.nome ?? null,
      blockName: block?.nome ?? null,
      className: classGroup?.nome ?? null,
      semesterCode: semester?.codigo ?? null,
      enrollmentId: row.matricula_turma_id
    };
  }

  function toNotificationSummary(
    row: DocumentNotificationRow,
    documentSummary: StudentDocumentSummary
  ): StudentDocumentNotificationSummary {
    return {
      id: row.id,
      unitId: row.unidade_id,
      userId: row.usuario_id,
      documentId: row.documento_id,
      documentType: documentSummary.type,
      type: row.tipo as StudentDocumentNotificationType,
      title: row.titulo || buildDocumentNotificationTitle(row.tipo as StudentDocumentNotificationType),
      message:
        row.mensagem ||
        buildDocumentNotificationMessage({
          type: row.tipo as StudentDocumentNotificationType,
          documentType: documentSummary.type,
          areaName: documentSummary.areaName,
          rejectionReason: documentSummary.rejectionReason
        }),
      actionLabel: buildDocumentNotificationActionLabel(
        row.tipo as StudentDocumentNotificationType
      ),
      read: row.lida,
      readAt: row.lida_em,
      createdAt: row.created_at,
      studentName: documentSummary.studentName,
      areaName: documentSummary.areaName,
      blockName: documentSummary.blockName
    };
  }

  return {
    userMap,
    studentMap,
    unitMap,
    enrollmentMap,
    classMap,
    semesterMap,
    areaMap,
    blockMap,
    toSummary,
    toNotificationSummary
  };
}

async function loadStudentAssignments(currentUser: SessionUser) {
  const supabase = await createSupabaseServerClient();
  const { data: enrollmentRowsData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .eq("aluno_id", currentUser.id)
    .eq("status", "ativa");

  if (enrollmentError) {
    throw new Error(
      "Não foi possível consultar as matrículas ativas do aluno para o envio do TCE."
    );
  }

  const enrollments = (enrollmentRowsData ?? []) as EnrollmentRow[];
  const classIds = [...new Set(enrollments.map((row) => row.turma_id))];

  const classesResult = classIds.length
    ? await supabase.from("turmas").select("*").in("id", classIds).eq("ativa", true)
    : { data: [], error: null };

  if (classesResult.error) {
    throw new Error(
      "Não foi possível consultar as turmas ativas vinculadas ao aluno."
    );
  }

  const classes = (classesResult.data ?? []) as ClassRow[];
  const semesterIds = [...new Set(classes.map((row) => row.semestre_id))];
  const areaIds = [
    ...new Set(
      classes.map((row) => row.area_estagio_id).filter(Boolean)
    )
  ] as string[];

  const [semesterResult, areaResult, blockResult, professorLinksResult] = await Promise.all([
    semesterIds.length
      ? supabase.from("semestres").select("*").in("id", semesterIds)
      : Promise.resolve({ data: [], error: null }),
    areaIds.length
      ? supabase.from("areas_estagio").select("*").in("id", areaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true }),
    enrollments.length
      ? supabase
          .from("vinculos_professor_aluno")
          .select("*")
          .in("matricula_turma_id", enrollments.map((row) => row.id))
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    semesterResult.error ||
    areaResult.error ||
    blockResult.error ||
    professorLinksResult.error
  ) {
    throw new Error(
      "Não foi possível montar o seletor de área e bloco para o TCE."
    );
  }

  const semesters = (semesterResult.data ?? []) as SemesterRow[];
  const visibleSemesters = semesters.filter(
    (semester) => semester.status === "ativo" || semester.status === "planejado"
  );
  const visibleSemesterIds = new Set(visibleSemesters.map((semester) => semester.id));
  const visibleClasses = classes.filter((classGroup) =>
    visibleSemesterIds.has(classGroup.semestre_id)
  );
  const visibleClassIds = new Set(visibleClasses.map((classGroup) => classGroup.id));
  const visibleEnrollments = enrollments.filter((enrollment) =>
    visibleClassIds.has(enrollment.turma_id)
  );
  const areas = (areaResult.data ?? []) as AreaRow[];
  const blocks = (blockResult.data ?? []) as BlockRow[];
  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const professorIds = [
    ...new Set(professorLinks.map((link) => link.professor_id))
  ] as string[];
  const professorUsersResult = professorIds.length
    ? await supabase.from("usuarios").select("*").in("id", professorIds)
    : { data: [], error: null };

  if (professorUsersResult.error) {
    throw new Error(
      "Não foi possível identificar os supervisores vinculados às áreas do aluno."
    );
  }

  const professorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const classMap = new Map(visibleClasses.map((row) => [row.id, row]));
  const semesterMap = new Map(visibleSemesters.map((row) => [row.id, row]));
  const areaMap = new Map(areas.map((row) => [row.id, row]));
  const blockMap = new Map(blocks.map((row) => [row.id, row]));
  const professorUserMap = new Map(professorUsers.map((row) => [row.id, row]));

  return visibleEnrollments
    .map((enrollment) => {
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup ? semesterMap.get(classGroup.semestre_id) ?? null : null;
      const area =
        classGroup?.area_estagio_id && areaMap.has(classGroup.area_estagio_id)
          ? areaMap.get(classGroup.area_estagio_id) ?? null
          : null;
      const block = area ? blockMap.get(area.bloco_id) ?? null : null;

      if (!classGroup || !semester || !area || !block) {
        return null;
      }

      const professorNames = professorLinks
        .filter((link) => link.matricula_turma_id === enrollment.id)
        .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
        .filter(Boolean) as string[];

      return {
        enrollmentId: enrollment.id,
        areaId: area.id,
        areaName: area.nome,
        blockName: block.nome,
        className: classGroup.nome,
        semesterCode: semester.codigo,
        professorNames,
        label: `${area.nome} · ${block.nome} · ${semester.codigo}`
      } satisfies StudentDocumentAreaOption;
    })
    .filter(Boolean)
    .sort((left, right) => left!.label.localeCompare(right!.label, "pt-BR")) as StudentDocumentAreaOption[];
}

async function loadStudentDocumentScopeByStudentIds(
  studentIds: string[],
  input?: {
    useAdminRead?: boolean;
    scope?: Awaited<ReturnType<typeof resolveScopedDataAccess>> | null;
  }
) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const readClient = input?.useAdminRead ? adminClient : supabase;
  const [studentRowsResult, userRowsResult, documentRowsResult, notificationRowsResult] =
    await Promise.all([
      studentIds.length
        ? readClient.from("alunos").select("*").in("usuario_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? readClient.from("usuarios").select("*").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? readClient.from("documentos_aluno").select("*").in("aluno_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? readClient
            .from("notificacoes_documentos_aluno")
            .select("*")
            .in("usuario_id", studentIds)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (
    studentRowsResult.error ||
    userRowsResult.error ||
    documentRowsResult.error ||
    notificationRowsResult.error
  ) {
    throw new Error(
      "Não foi possível consolidar os dados de documentos dos alunos."
    );
  }

  const documents = (documentRowsResult.data ?? []) as DocumentRow[];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentById = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const requiredCourseDocumentIds = [
    ...new Set(
      documents.map((row) => row.documento_obrigatorio_curso_id).filter(Boolean)
    )
  ] as string[];
  const reviewerIds = [
    ...new Set(documents.map((row) => row.validado_por).filter(Boolean))
  ] as string[];
  const unitIds = [
    ...new Set(
      [
        ...documents.map((row) => row.unidade_id),
        ...(userRowsResult.data ?? []).map((row) => (row as UserRow).unidade_id)
      ].filter(Boolean)
    )
  ] as string[];

  const [
    reviewerUsersResult,
    enrollmentRowsResult,
    unitRowsResult,
    requiredCourseDocumentsResult
  ] = await Promise.all([
    reviewerIds.length
      ? adminClient.from("usuarios").select("*").in("id", reviewerIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? readClient.from("matriculas_turma").select("*").in("aluno_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? readClient.from("unidades").select("*").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    requiredCourseDocumentIds.length
      ? readClient
          .from("documentos_obrigatorios_curso")
          .select("*")
          .in("id", requiredCourseDocumentIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    reviewerUsersResult.error ||
    enrollmentRowsResult.error ||
    unitRowsResult.error ||
    requiredCourseDocumentsResult.error
  ) {
    throw new Error(
      "Não foi possível carregar o contexto complementar dos documentos dos alunos."
    );
  }

  const enrollments = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const classIds = [...new Set(enrollments.map((row) => row.turma_id))];
  const classesResult = classIds.length
    ? await readClient.from("turmas").select("*").in("id", classIds)
    : { data: [], error: null };

  if (classesResult.error) {
    throw new Error(
      "Não foi possível carregar as turmas vinculadas aos documentos dos alunos."
    );
  }

  const classes = (classesResult.data ?? []) as ClassRow[];
  const semesterIds = [...new Set(classes.map((row) => row.semestre_id))];
  const allAreaIds = [
    ...new Set(
      [
        ...documents.map((row) => row.area_estagio_id),
        ...classes.map((row) => row.area_estagio_id)
      ].filter(Boolean)
    )
  ] as string[];
  const [semesterRowsResult, areaRowsResult, professorLinksResult] = await Promise.all([
    semesterIds.length
      ? readClient.from("semestres").select("*").in("id", semesterIds)
      : Promise.resolve({ data: [], error: null }),
    allAreaIds.length
      ? readClient.from("areas_estagio").select("*").in("id", allAreaIds)
      : Promise.resolve({ data: [], error: null }),
    enrollments.length
      ? readClient
          .from("vinculos_professor_aluno")
          .select("*")
          .in("matricula_turma_id", enrollments.map((row) => row.id))
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    semesterRowsResult.error ||
    areaRowsResult.error ||
    professorLinksResult.error
  ) {
    throw new Error(
      "Não foi possível completar o contexto de área e semestre dos documentos."
    );
  }

  const areaRows = (areaRowsResult.data ?? []) as AreaRow[];
  const blockIds = [...new Set(areaRows.map((row) => row.bloco_id))];
  const blockRowsResult = blockIds.length
    ? await readClient.from("blocos_estagio").select("*").in("id", blockIds)
    : { data: [], error: null };

  if (blockRowsResult.error) {
    throw new Error(
      "Não foi possível consultar os blocos vinculados aos documentos e áreas do aluno."
    );
  }

  const requiredCourseDocuments =
    (requiredCourseDocumentsResult.data ?? []) as RequiredCourseDocumentRow[];
  const requiredCourseDocumentById = new Map(
    requiredCourseDocuments.map((row) => [row.id, row])
  );
  const scope = input?.scope ?? null;
  const visibleDocumentIds = new Set(
    documents
      .filter((row) => {
        if (!scope?.restrictToCourse) {
          return true;
        }

        if (
          row.oferta_curso_unidade_id &&
          scope.offerIds.includes(row.oferta_curso_unidade_id)
        ) {
          return true;
        }

        if (row.documento_obrigatorio_curso_id) {
          const requiredCourseDocument = requiredCourseDocumentById.get(
            row.documento_obrigatorio_curso_id
          );

          if (requiredCourseDocument?.curso_id === scope.cursoId) {
            return true;
          }
        }

        const student = studentById.get(row.aluno_id);

        if (!student || student.curso_id !== scope.cursoId) {
          return false;
        }

        if (scope.scopeKind === "course_manager") {
          return true;
        }

        return (
          scope.unitIds.length === 0 ||
          scope.unitIds.includes(student.unidade_id ?? "")
        );
      })
      .map((row) => row.id)
  );
  const users = [
    ...((userRowsResult.data ?? []) as UserRow[]),
    ...((reviewerUsersResult.data ?? []) as UserRow[])
  ];

  return {
    users,
    students: studentRows,
    units: (unitRowsResult.data ?? []) as UnitRow[],
    documents: documents.filter((row) => visibleDocumentIds.has(row.id)),
    notifications: ((notificationRowsResult.data ?? []) as DocumentNotificationRow[]).filter(
      (row) => visibleDocumentIds.has(row.documento_id)
    ),
    enrollments,
    classes,
    semesters: (semesterRowsResult.data ?? []) as SemesterRow[],
    areas: areaRows,
    blocks: (blockRowsResult.data ?? []) as BlockRow[],
    professorLinks: (professorLinksResult.data ?? []) as ProfessorLinkRow[]
  } satisfies StudentDocumentScopeContext;
}

async function loadMasterStudentDocumentInstitutionalFilterOptions() {
  const adminClient = createSupabaseAdminClient();
  const [institutionsResult, unitsResult] = await Promise.all([
    adminClient.from("instituicoes").select("*").order("nome"),
    adminClient.from("unidades").select("*").order("nome")
  ]);

  if (institutionsResult.error || unitsResult.error) {
    throw new Error(
      "Não foi possível carregar as unidades para a leitura documental global."
    );
  }

  return {
    institutions: ((institutionsResult.data ?? []) as InstitutionRow[])
      .map((institution) => ({
        id: institution.id,
        name: institution.nome
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    units: ((unitsResult.data ?? []) as UnitRow[])
      .map((unit) => ({
        value: unit.id,
        label: unit.nome,
        institutionId: unit.instituicao_id
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"))
  };
}

async function loadScopedStudentDocumentUnitOptions(unitIds: string[]) {
  const visibleUnitIds = uniqueStringValues(unitIds);

  if (!visibleUnitIds.length) {
    return [] as StudentDocumentDirectoryUnitOption[];
  }

  const adminClient = createSupabaseAdminClient();
  const { data: unitRowsData, error: unitRowsError } = await adminClient
    .from("unidades")
    .select("*")
    .in("id", visibleUnitIds)
    .order("nome");

  if (unitRowsError) {
    throw new Error(
      "NÃ£o foi possÃ­vel carregar as unidades visÃ­veis para o contexto documental atual."
    );
  }

  return ((unitRowsData ?? []) as UnitRow[])
    .map((unit) => ({
      value: unit.id,
      label: unit.nome,
      institutionId: unit.instituicao_id
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function normalizeStudentDocumentInstitutionalFilters(input: {
  institutions: StudentDocumentDirectoryInstitutionOption[];
  units: StudentDocumentDirectoryUnitOption[];
  institutionId?: string | null;
  unitId?: string | null;
}) {
  const requestedInstitutionId = (input.institutionId ?? "").trim();
  const validInstitutionId = input.institutions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";

  const requestedUnitId = (input.unitId ?? "").trim();
  const requestedUnit = input.units.find((unit) => unit.value === requestedUnitId) ?? null;
  const validUnitId =
    requestedUnit &&
    (!validInstitutionId || requestedUnit.institutionId === validInstitutionId)
      ? requestedUnitId
      : "";

  const visibleUnitIds = validInstitutionId
    ? input.units
        .filter((unit) => unit.institutionId === validInstitutionId)
        .map((unit) => unit.value)
    : [];

  return {
    institutionId: validInstitutionId,
    unitId: validUnitId,
    visibleUnitIds
  };
}

function buildStudentNotificationCenter(
  notifications: DocumentNotificationRow[],
  documents: StudentDocumentSummary[]
): StudentDocumentNotificationCenter {
  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const historyItems = notifications
    .map((row) => {
      const document = documentMap.get(row.documento_id);
      return document
        ? {
            id: row.id,
            unitId: row.unidade_id,
            userId: row.usuario_id,
            documentId: row.documento_id,
            documentType: document.type,
            type: row.tipo as StudentDocumentNotificationType,
            title:
              row.titulo ||
              buildDocumentNotificationTitle(row.tipo as StudentDocumentNotificationType),
            message:
              row.mensagem ||
              buildDocumentNotificationMessage({
                type: row.tipo as StudentDocumentNotificationType,
                documentType: document.type,
                areaName: document.areaName,
                rejectionReason: document.rejectionReason
              }),
            actionLabel: buildDocumentNotificationActionLabel(
              row.tipo as StudentDocumentNotificationType
            ),
            read: row.lida,
            readAt: row.lida_em,
            createdAt: row.created_at,
            studentName: document.studentName,
            areaName: document.areaName,
            blockName: document.blockName
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right!.createdAt.localeCompare(left!.createdAt)) as StudentDocumentNotificationSummary[];

  return {
    unreadCount: historyItems.filter((item) => !item.read).length,
    pendingItems: historyItems.filter((item) => !item.read),
    historyItems
  };
}

function buildAreaLabelsForStudent(input: {
  studentId: string;
  context: StudentDocumentScopeContext;
}) {
  const classMap = new Map(input.context.classes.map((row) => [row.id, row]));
  const areaMap = new Map(input.context.areas.map((row) => [row.id, row]));
  const blockMap = new Map(input.context.blocks.map((row) => [row.id, row]));

  const labels = input.context.enrollments
    .filter((enrollment) => enrollment.aluno_id === input.studentId && enrollment.status === "ativa")
    .map((enrollment) => {
      const classGroup = classMap.get(enrollment.turma_id);
      const area =
        classGroup?.area_estagio_id && areaMap.has(classGroup.area_estagio_id)
          ? areaMap.get(classGroup.area_estagio_id) ?? null
          : null;
      const block = area ? blockMap.get(area.bloco_id) ?? null : null;

      if (!area || !block) {
        return null;
      }

      return `${block.nome} · ${area.nome}`;
    })
    .filter(Boolean) as string[];

  return [...new Set(labels)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function buildAreaIdsForStudent(input: {
  studentId: string;
  context: StudentDocumentScopeContext;
}) {
  const classMap = new Map(input.context.classes.map((row) => [row.id, row]));

  return [
    ...new Set(
      input.context.enrollments
        .filter((enrollment) => enrollment.aluno_id === input.studentId && enrollment.status === "ativa")
        .map((enrollment) => classMap.get(enrollment.turma_id)?.area_estagio_id ?? null)
        .filter(Boolean)
    )
  ] as string[];
}

function matchesDirectoryStatusFilter(
  entry: StudentDocumentDirectoryEntry,
  status: DirectoryStatusFilter
) {
  switch (status) {
    case "sem_documentos":
      return entry.totalDocuments === 0;
    case "enviado":
      return entry.pendingCount > 0;
    case "reprovado":
      return entry.rejectedCount > 0;
    case "aprovado":
      return (
        entry.totalDocuments > 0 &&
        entry.pendingCount === 0 &&
        entry.rejectedCount === 0 &&
        Boolean(entry.currentVaccination || entry.currentTces.length)
      );
    default:
      return true;
  }
}

function buildDirectoryEntries(
  context: StudentDocumentScopeContext,
  viewerRole: InstitutionalViewerRole
) {
  const maps = buildStudentDocumentSummaryMaps(context);
  const documentsByStudent = new Map<string, StudentDocumentSummary[]>();

  for (const row of context.documents) {
    const summary = maps.toSummary(row);
    const group = documentsByStudent.get(summary.studentId) ?? [];
    group.push(summary);
    documentsByStudent.set(summary.studentId, group);
  }

  const notificationsByStudent = new Map<string, DocumentNotificationRow[]>();

  for (const notification of context.notifications) {
    const relatedDocument = context.documents.find(
      (document) => document.id === notification.documento_id
    );

    if (!relatedDocument) {
      continue;
    }

    const group = notificationsByStudent.get(relatedDocument.aluno_id) ?? [];
    group.push(notification);
    notificationsByStudent.set(relatedDocument.aluno_id, group);
  }

  return context.users
    .filter((user) => context.students.some((student) => student.usuario_id === user.id))
    .map((user) => {
      const student = context.students.find((row) => row.usuario_id === user.id) ?? null;
      const studentDocuments = (documentsByStudent.get(user.id) ?? []).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
      const currentVaccination =
        studentDocuments.find(
          (document) => document.type === "carteira_vacinacao" && document.active
        ) ?? null;
      const currentTces = studentDocuments.filter(
        (document) => document.type === "tce" && document.active
      );
      const studentNotifications = notificationsByStudent.get(user.id) ?? [];
      const resolvedUnitId =
        user.unidade_id ??
        currentVaccination?.unitId ??
        currentTces[0]?.unitId ??
        studentDocuments[0]?.unitId ??
        null;
      const unit = resolvedUnitId
        ? context.units.find((row) => row.id === resolvedUnitId) ?? null
        : null;

      return {
        studentId: user.id,
        studentName: user.nome_completo,
        registration: student?.matricula ?? "Sem matrícula",
        email: user.email,
        institutionId: unit?.instituicao_id ?? null,
        unitId: resolvedUnitId,
        unitName: unit?.nome ?? null,
        active: user.ativo,
        areaIds: buildAreaIdsForStudent({
          studentId: user.id,
          context
        }),
        areaLabels: buildAreaLabelsForStudent({
          studentId: user.id,
          context
        }),
        currentVaccination,
        currentTces,
        totalDocuments: studentDocuments.length,
        pendingCount: studentDocuments.filter(
          (document) => document.active && document.status === "enviado"
        ).length,
        rejectedCount: studentDocuments.filter(
          (document) => document.active && document.status === "reprovado"
        ).length,
        unreadNotificationCount: studentNotifications.filter((notification) => !notification.lida)
          .length,
        latestDocumentAt: selectMostRecentTimestamp(
          studentDocuments.map((document) => document.createdAt)
        )
      } satisfies StudentDocumentDirectoryEntry;
    })
    .sort((left, right) => left.studentName.localeCompare(right.studentName, "pt-BR"));
}

async function loadProfessorStudentIds(currentUser: SessionUser) {
  const supabase = await createSupabaseServerClient();
  const { data: linkRowsData, error: linkRowsError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("professor_id", currentUser.id)
    .eq("ativo", true);

  if (linkRowsError) {
    throw new Error(
      "Não foi possível consultar os alunos vinculados ao professor supervisor."
    );
  }

  const links = (linkRowsData ?? []) as ProfessorLinkRow[];
  const validLinks = links.filter(
    (link) => !link.data_fim || link.data_fim >= new Date().toISOString().slice(0, 10)
  );

  if (!validLinks.length) {
    return [] as string[];
  }

  const enrollmentIds = [...new Set(validLinks.map((link) => link.matricula_turma_id))];
  const { data: enrollmentRowsData, error: enrollmentRowsError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentRowsError) {
    throw new Error(
      "Não foi possível consultar as matrículas supervisionadas pelo professor."
    );
  }

  return [
    ...new Set(
      ((enrollmentRowsData ?? []) as EnrollmentRow[]).map((row) => row.aluno_id)
    )
  ];
}

async function loadStudentUsersByScope(input: {
  currentUser: SessionUser;
  viewerRole: InstitutionalViewerRole;
  unitIdFilter?: string | null;
  unitIdsFilter?: string[] | null;
  resolvedScope?: Awaited<ReturnType<typeof resolveScopedDataAccess>> | null;
  useAdminRead?: boolean;
}): Promise<StudentDocumentStudentScope> {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const readClient =
    input.viewerRole === "coordenador_master" || input.useAdminRead
      ? adminClient
      : supabase;

  if (input.viewerRole === "professor") {
    return {
      studentIds: await loadProfessorStudentIds(input.currentUser),
      scope: null
    };
  }

  const { data: studentProfileRowData, error: studentProfileError } = await readClient
    .from("perfis")
    .select("id")
    .eq("codigo", "aluno")
    .maybeSingle();

  if (studentProfileError || !studentProfileRowData) {
    throw new Error("O perfil de aluno não está configurado para esta consulta.");
  }

  if (input.viewerRole === "coordenador") {
    const scope =
      input.resolvedScope ??
      (await resolveScopedDataAccess(input.currentUser, {
        supabase
      }));

    if (scope.scopeKind === "none") {
      return {
        studentIds: [],
        scope
      };
    }

    if (scope.restrictToCourse) {
      let studentQuery = readClient
        .from("alunos")
        .select("usuario_id, unidade_id")
        .eq("curso_id", scope.cursoId ?? "__no_course__");

      if (input.unitIdFilter) {
        studentQuery = studentQuery.eq("unidade_id", input.unitIdFilter);
      } else if (scope.offerIds.length > 0) {
        studentQuery = studentQuery.in("oferta_curso_unidade_id", scope.offerIds);
      } else if (scope.unitIds.length > 0) {
        studentQuery = studentQuery.in("unidade_id", scope.unitIds);
      }

      const { data: scopedStudentRows, error: scopedStudentRowsError } =
        await studentQuery;

      if (scopedStudentRowsError) {
        throw new Error(
          "NÃ£o foi possÃ­vel consultar os alunos do curso visÃ­vel neste contexto."
        );
      }

      return {
        studentIds: ((scopedStudentRows ?? []) as Array<{ usuario_id: string }>).map(
          (row) => row.usuario_id
        ),
        scope
      };
    }

    let coordinatorQuery = readClient
      .from("usuarios")
      .select("id")
      .eq("perfil_id", (studentProfileRowData as { id: number }).id);

    if (scope.unitIds.length > 0) {
      coordinatorQuery = coordinatorQuery.in("unidade_id", scope.unitIds);
    } else {
      coordinatorQuery = coordinatorQuery.eq("unidade_id", "__no_unit__");
    }

    const { data: coordinatorStudentRows, error: coordinatorStudentRowsError } =
      await coordinatorQuery;

    if (coordinatorStudentRowsError) {
      throw new Error("NÃ£o foi possÃ­vel consultar os alunos disponÃ­veis neste escopo.");
    }

    return {
      studentIds: ((coordinatorStudentRows ?? []) as Array<{ id: string }>).map(
        (row) => row.id
      ),
      scope
    };
  }

  let query = readClient
    .from("usuarios")
    .select("id")
    .eq("perfil_id", (studentProfileRowData as { id: number }).id);

  if (input.unitIdFilter) {
    query = query.eq("unidade_id", input.unitIdFilter);
  } else if (input.unitIdsFilter?.length) {
    query = query.in("unidade_id", input.unitIdsFilter);
  }

  const { data: studentUserRows, error: studentUserError } = await query;

  if (studentUserError) {
    throw new Error("Não foi possível consultar os alunos disponíveis neste escopo.");
  }

  return {
    studentIds: ((studentUserRows ?? []) as Array<{ id: string }>).map(
      (row) => row.id
    ),
    scope: null
  };
}

export async function getStudentDocumentUnreadNotificationCount(
  currentUser: SessionUser
) {
  if (currentUser.role !== "aluno") {
    return 0;
  }

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notificacoes_documentos_aluno")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", currentUser.id)
    .eq("lida", false);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getStudentDocumentScopeForCurrentStudent(
  currentUser: SessionUser
) {
  const assignments = await loadStudentAssignments(currentUser);
  const context = await loadStudentDocumentScopeByStudentIds([currentUser.id]);
  const maps = buildStudentDocumentSummaryMaps(context);
  const documentSummaries = context.documents
    .map((row) => maps.toSummary(row))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const notifications = buildStudentNotificationCenter(
    context.notifications.filter((row) => row.usuario_id === currentUser.id),
    documentSummaries
  );
  const currentVaccination =
    documentSummaries.find(
      (document) =>
        document.type === "carteira_vacinacao" && document.active
    ) ?? null;

  const studentUser = context.users.find((row) => row.id === currentUser.id) ?? null;
  const studentProfile =
    context.students.find((row) => row.usuario_id === currentUser.id) ?? null;
  const unit = studentUser?.unidade_id
    ? context.units.find((row) => row.id === studentUser.unidade_id) ?? null
    : null;

  return {
    student: {
      id: currentUser.id,
      name: currentUser.name,
      registration: studentProfile?.matricula ?? "Sem matrícula",
      email: currentUser.email,
      unitName: unit?.nome ?? currentUser.unitName ?? null
    },
    vaccinationCurrent: currentVaccination,
    vaccinationHistory: documentSummaries.filter(
      (document) => document.type === "carteira_vacinacao"
    ),
    tceOptions: assignments,
    tceDocuments: documentSummaries.filter((document) => document.type === "tce"),
    notifications
  } satisfies StudentDocumentsPageData;
}

export async function getStudentDocumentDirectoryPageData(input: {
  currentUser: SessionUser;
  viewerRole: InstitutionalViewerRole;
  search?: string | null;
  institutionId?: string | null;
  areaId?: string | null;
  status?: string | null;
  unitId?: string | null;
}) {
  const coordinatorSupabase =
    input.viewerRole === "coordenador"
      ? await createSupabaseServerClient()
      : null;
  const coordinatorScope =
    input.viewerRole === "coordenador" && coordinatorSupabase
      ? await resolveScopedDataAccess(input.currentUser, {
          supabase: coordinatorSupabase
        })
      : null;
  const institutionalFilterOptions =
    input.viewerRole === "coordenador_master"
      ? await loadMasterStudentDocumentInstitutionalFilterOptions()
      : input.viewerRole === "coordenador" &&
          coordinatorScope?.scopeKind === "course_manager"
        ? {
            institutions: [] as StudentDocumentDirectoryInstitutionOption[],
            units: await loadScopedStudentDocumentUnitOptions(coordinatorScope.unitIds)
          }
      : {
          institutions: [] as StudentDocumentDirectoryInstitutionOption[],
          units: [] as StudentDocumentDirectoryUnitOption[]
        };
  const useAdminRead =
    input.viewerRole === "coordenador_master" ||
    (input.viewerRole === "coordenador" &&
      coordinatorScope?.scopeKind === "course_manager");
  const normalizedInstitutionalFilters = normalizeStudentDocumentInstitutionalFilters({
    institutions: institutionalFilterOptions.institutions,
    units: institutionalFilterOptions.units,
    institutionId: input.institutionId ?? null,
    unitId: input.unitId ?? null
  });
  const { studentIds, scope } = await loadStudentUsersByScope({
    currentUser: input.currentUser,
    viewerRole: input.viewerRole,
    unitIdFilter: normalizedInstitutionalFilters.unitId || null,
    unitIdsFilter:
      input.viewerRole === "coordenador_master" &&
      !normalizedInstitutionalFilters.unitId &&
      normalizedInstitutionalFilters.visibleUnitIds.length > 0
        ? normalizedInstitutionalFilters.visibleUnitIds
        : input.viewerRole === "coordenador" &&
            coordinatorScope?.scopeKind === "course_manager" &&
            !normalizedInstitutionalFilters.unitId &&
            coordinatorScope.unitIds.length > 0
          ? coordinatorScope.unitIds
          : null,
    resolvedScope: coordinatorScope,
    useAdminRead
  });
  const context = await loadStudentDocumentScopeByStudentIds(studentIds, {
    useAdminRead,
    scope
  });
  const entries = buildDirectoryEntries(context, input.viewerRole);
  const searchTerm = normalizeSearchTerm(input.search);
  const areaId = (input.areaId ?? "").trim();
  const institutionId = normalizedInstitutionalFilters.institutionId;
  const unitId = normalizedInstitutionalFilters.unitId;
  const requestedStatus = (input.status ?? "todos").trim() as DirectoryStatusFilter;
  const statusFilter = DIRECTORY_STATUS_FILTERS.some(
    (option) => option.value === requestedStatus
  )
    ? requestedStatus
    : "todos";

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      !searchTerm ||
      `${entry.studentName} ${entry.registration} ${entry.email} ${entry.unitName ?? ""}`
        .toLowerCase()
        .includes(searchTerm);
    const matchesInstitution =
      !institutionId || entry.institutionId === institutionId;
    const matchesUnit = !unitId || entry.unitId === unitId;
    const matchesArea =
      !areaId ||
      entry.areaIds.includes(areaId) ||
      entry.currentTces.some((document) => document.areaId === areaId);
    const matchesStatus = matchesDirectoryStatusFilter(entry, statusFilter);

    return matchesSearch && matchesInstitution && matchesUnit && matchesArea && matchesStatus;
  });

  const areaOptions = context.areas
    .map((area) => {
      const block = context.blocks.find((row) => row.id === area.bloco_id) ?? null;
      return {
        value: area.id,
        label: block ? `${block.nome} · ${area.nome}` : area.nome
      } satisfies StudentDocumentDirectoryFilterOption;
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  return {
    viewerRole: input.viewerRole,
    title:
      input.viewerRole === "professor"
        ? "Documentos dos alunos"
        : input.viewerRole === "coordenador"
          ? "Documentos dos alunos"
          : "Documentos institucionais dos alunos",
    description:
      input.viewerRole === "professor"
        ? "Acompanhe e valide a carteira de vacinação e os TCEs dos alunos sob sua supervisão."
        : input.viewerRole === "coordenador"
          ? "Acompanhe, revise e intervenha nas validações documentais dos alunos da unidade."
          : "Visão global multiunidade para acompanhamento documental institucional.",
    filters: {
      search: input.search?.trim() ?? "",
      institutionId,
      areaId,
      status: statusFilter,
      unitId
    },
    institutionOptions: institutionalFilterOptions.institutions,
    areaOptions,
    unitOptions: institutionalFilterOptions.units,
    statusOptions: buildDirectoryStatusOptions(),
    metrics: {
      totalStudents: filteredEntries.length,
      withPendingDocuments: filteredEntries.filter((entry) => entry.pendingCount > 0).length,
      withRejectedDocuments: filteredEntries.filter((entry) => entry.rejectedCount > 0).length,
      withUnreadNotifications: filteredEntries.filter(
        (entry) => entry.unreadNotificationCount > 0
      ).length
    },
    entries: filteredEntries
  } satisfies StudentDocumentDirectoryPageData;
}

export async function getStudentDocumentDetailPageData(input: {
  currentUser: SessionUser;
  viewerRole: InstitutionalViewerRole;
  studentId: string;
}) {
  const coordinatorSupabase =
    input.viewerRole === "coordenador"
      ? await createSupabaseServerClient()
      : null;
  const coordinatorScope =
    input.viewerRole === "coordenador" && coordinatorSupabase
      ? await resolveScopedDataAccess(input.currentUser, {
          supabase: coordinatorSupabase
        })
      : null;
  const useAdminRead =
    input.viewerRole === "coordenador_master" ||
    (input.viewerRole === "coordenador" &&
      coordinatorScope?.scopeKind === "course_manager");
  const { studentIds, scope } = await loadStudentUsersByScope({
    currentUser: input.currentUser,
    viewerRole: input.viewerRole,
    resolvedScope: coordinatorScope,
    useAdminRead
  });

  if (!studentIds.includes(input.studentId)) {
    return null;
  }

  const context = await loadStudentDocumentScopeByStudentIds([input.studentId], {
    useAdminRead,
    scope
  });
  const maps = buildStudentDocumentSummaryMaps(context);
  const studentUser = context.users.find((row) => row.id === input.studentId) ?? null;
  const studentProfile =
    context.students.find((row) => row.usuario_id === input.studentId) ?? null;

  if (!studentUser || !studentProfile) {
    return null;
  }

  const documents = context.documents
    .map((row) => maps.toSummary(row))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const unit = studentUser.unidade_id
    ? context.units.find((row) => row.id === studentUser.unidade_id) ?? null
    : null;

  return {
    viewerRole: input.viewerRole,
    canReview: input.viewerRole === "professor" || input.viewerRole === "coordenador",
    student: {
      id: studentUser.id,
      name: studentUser.nome_completo,
      registration: studentProfile.matricula,
      email: studentUser.email,
      unitName: unit?.nome ?? null,
      active: studentUser.ativo,
      areaLabels: buildAreaLabelsForStudent({
        studentId: studentUser.id,
        context
      })
    },
    vaccinationDocuments: documents.filter(
      (document) => document.type === "carteira_vacinacao"
    ),
    tceDocuments: documents.filter((document) => document.type === "tce")
  } satisfies StudentDocumentDetailPageData;
}

export async function getAccessibleStudentDocumentForDownload(
  currentUser: SessionUser,
  documentId: string
) {
  const supabase = await createSupabaseServerClient();
  let documentRow: DocumentRow | null = null;

  if (currentUser.role === "aluno") {
    const { data: documentRowData, error: documentError } = await supabase
      .from("documentos_aluno")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError || !documentRowData) {
      return null;
    }

    documentRow = documentRowData as DocumentRow;

    if (documentRow.aluno_id !== currentUser.id) {
      return null;
    }
  } else {
    const viewerRole =
      currentUser.role === "professor" ||
      currentUser.role === "coordenador" ||
      currentUser.role === "coordenador_master"
        ? currentUser.role
        : null;

    if (!viewerRole) {
      return null;
    }

    const coordinatorScope =
      viewerRole === "coordenador"
        ? await resolveScopedDataAccess(currentUser, {
            supabase
          })
        : null;
    const useAdminRead =
      viewerRole === "coordenador_master" ||
      (viewerRole === "coordenador" &&
        coordinatorScope?.scopeKind === "course_manager");
    const readClient = useAdminRead ? createSupabaseAdminClient() : supabase;
    const { data: documentRowData, error: documentError } = await readClient
      .from("documentos_aluno")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError || !documentRowData) {
      return null;
    }

    documentRow = documentRowData as DocumentRow;

    const { studentIds } = await loadStudentUsersByScope({
      currentUser,
      viewerRole,
      resolvedScope: coordinatorScope,
      useAdminRead
    });

    if (!studentIds.includes(documentRow.aluno_id)) {
      return null;
    }
  }

  if (!documentRow) {
    return null;
  }

  const downloadUrl = await buildStudentDocumentDownloadUrl({
    storagePath: documentRow.storage_path,
    fileName: documentRow.arquivo_nome
  });

  if (!downloadUrl) {
    return null;
  }

  return {
    url: downloadUrl,
    fileName: documentRow.arquivo_nome
  };
}
