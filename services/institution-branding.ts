import { unstable_noStore as noStore } from "next/cache";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];

export const INSTITUTION_BRANDING_MAX_BYTES = 1024 * 1024;
export const INSTITUTION_BRANDING_ACCEPTED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp"
] as const;
export const INSTITUTION_BRANDING_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
] as const;

const INSTITUTION_BRANDING_S3_SCHEME = "s3://";

interface InstitutionBrandingS3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface InstitutionBrandingSummary {
  institutionId: string;
  displayName: string;
  primaryLogoUrl: string | null;
  compactLogoUrl: string | null;
}

let institutionBrandingS3Client: S3Client | null = null;
let institutionBrandingS3ClientSignature: string | null = null;

function getInstitutionBrandingS3Config(): InstitutionBrandingS3Config {
  const region = process.env.AWS_REGION?.trim() ?? "";
  const bucket = process.env.AWS_S3_BUCKET?.trim() ?? "";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "As variáveis AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY devem estar configuradas para a identidade visual das instituições."
    );
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey
  };
}

function getInstitutionBrandingS3Client() {
  const config = getInstitutionBrandingS3Config();
  const signature = `${config.region}:${config.bucket}:${config.accessKeyId}`;

  if (
    institutionBrandingS3Client &&
    institutionBrandingS3ClientSignature === signature
  ) {
    return institutionBrandingS3Client;
  }

  institutionBrandingS3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  institutionBrandingS3ClientSignature = signature;

  return institutionBrandingS3Client;
}

function normalizeStorageSegment(
  value: string | null | undefined,
  fallback: string,
  maxLength = 64
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
  const normalizedBaseName = normalizeStorageSegment(baseName, "logo", 80);

  return extension ? `${normalizedBaseName}.${extension}` : normalizedBaseName;
}

function isInstitutionBrandingS3StoragePath(storagePath: string) {
  return storagePath.startsWith(INSTITUTION_BRANDING_S3_SCHEME);
}

function parseInstitutionBrandingS3StoragePath(storagePath: string) {
  if (!isInstitutionBrandingS3StoragePath(storagePath)) {
    return null;
  }

  const normalizedPath = storagePath.slice(INSTITUTION_BRANDING_S3_SCHEME.length);
  const firstSlashIndex = normalizedPath.indexOf("/");

  if (firstSlashIndex <= 0) {
    return null;
  }

  return {
    bucket: normalizedPath.slice(0, firstSlashIndex),
    key: normalizedPath.slice(firstSlashIndex + 1)
  };
}

function buildPersistedInstitutionBrandingStoragePath(storageKey: string) {
  const { bucket } = getInstitutionBrandingS3Config();
  return `${INSTITUTION_BRANDING_S3_SCHEME}${bucket}/${storageKey}`;
}

function resolveInstitutionIdForBranding(currentUser: SessionUser) {
  if (currentUser.contextoAtivo?.instituicaoId) {
    return currentUser.contextoAtivo.instituicaoId;
  }

  if (currentUser.instituicaoId) {
    return currentUser.instituicaoId;
  }

  const activeContextInstitutionIds = [
    ...new Set(
      currentUser.contextosDisponiveis
        .filter((context) => context.ativo)
        .map((context) => context.instituicaoId)
        .filter((institutionId): institutionId is string => Boolean(institutionId))
    )
  ];

  if (activeContextInstitutionIds.length === 1) {
    return activeContextInstitutionIds[0];
  }

  const availableInstitutionIds = [
    ...new Set(
      currentUser.contextosDisponiveis
        .map((context) => context.instituicaoId)
        .filter((institutionId): institutionId is string => Boolean(institutionId))
    )
  ];

  return availableInstitutionIds.length === 1 ? availableInstitutionIds[0] : null;
}

export function buildInstitutionBrandingStoragePath(input: {
  institutionId: string;
  variant: "principal" | "compacta";
  fileName: string;
  timestamp?: number;
}) {
  const normalizedFileName = normalizeStorageFileName(input.fileName);
  const extension = normalizedFileName.includes(".")
    ? normalizedFileName.slice(normalizedFileName.lastIndexOf("."))
    : "";
  const normalizedVariant =
    input.variant === "compacta" ? "logo-compacta" : "logo-principal";
  const timestamp = input.timestamp ?? Date.now();

  return buildPersistedInstitutionBrandingStoragePath(
    [
      "instituicoes",
      input.institutionId,
      "identidade",
      `${normalizedVariant}-${timestamp}${extension}`
    ].join("/")
  );
}

export async function uploadInstitutionBrandingBinary(input: {
  storagePath: string;
  fileBuffer: Buffer;
  contentType: string;
}) {
  const location = parseInstitutionBrandingS3StoragePath(input.storagePath);

  if (!location) {
    throw new Error("O caminho de storage da identidade visual é inválido.");
  }

  const s3Client = getInstitutionBrandingS3Client();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: location.bucket,
      Key: location.key,
      Body: input.fileBuffer,
      ContentType: input.contentType
    })
  );
}

export async function removeInstitutionBrandingBinary(
  storagePath: string | null | undefined
) {
  if (!storagePath) {
    return;
  }

  const location = parseInstitutionBrandingS3StoragePath(storagePath);

  if (!location) {
    return;
  }

  const s3Client = getInstitutionBrandingS3Client();
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: location.bucket,
      Key: location.key
    })
  );
}

export async function getInstitutionBrandingDownloadUrl(
  storagePath: string | null | undefined,
  expiresInSeconds = 43200
) {
  if (!storagePath) {
    return null;
  }

  try {
    const location = parseInstitutionBrandingS3StoragePath(storagePath);

    if (!location) {
      return null;
    }

    const s3Client = getInstitutionBrandingS3Client();

    return getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: location.bucket,
        Key: location.key
      }),
      { expiresIn: expiresInSeconds }
    );
  } catch {
    return null;
  }
}

export function getInstitutionBrandingFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

export function resolveAcceptedInstitutionBrandingMimeType(
  file: File,
  extension: string
) {
  const mime = file.type.trim().toLowerCase();

  if (
    mime &&
    INSTITUTION_BRANDING_ACCEPTED_MIME_TYPES.includes(mime as never)
  ) {
    return mime;
  }

  if (extension === "png") {
    return "image/png";
  }

  if (["jpg", "jpeg"].includes(extension)) {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "";
}

export async function loadInstitutionBrandingForCurrentUser(
  currentUser: SessionUser
): Promise<InstitutionBrandingSummary | null> {
  noStore();
  const institutionId = resolveInstitutionIdForBranding(currentUser);

  if (!institutionId) {
    return null;
  }

  return loadInstitutionBrandingByInstitutionId(institutionId);
}

export async function loadInstitutionBrandingByInstitutionId(
  institutionId: string | null | undefined
): Promise<InstitutionBrandingSummary | null> {
  noStore();

  if (!institutionId) {
    return null;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("instituicoes")
    .select("id, nome, nome_exibicao, logo_principal_path, logo_compacta_path")
    .eq("id", institutionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as Pick<
    InstitutionRow,
    "id" | "nome" | "nome_exibicao" | "logo_principal_path" | "logo_compacta_path"
  >;

  const [primaryLogoUrl, compactLogoUrl] = await Promise.all([
    getInstitutionBrandingDownloadUrl(row.logo_principal_path),
    getInstitutionBrandingDownloadUrl(row.logo_compacta_path)
  ]);

  return {
    institutionId: row.id,
    displayName: row.nome_exibicao?.trim() || row.nome,
    primaryLogoUrl,
    compactLogoUrl
  };
}
