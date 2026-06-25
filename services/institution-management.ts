import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getInstitutionBrandingDownloadUrl } from "@/services/institution-branding";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];

export interface InstitutionManagementSummary {
  totalInstitutions: number;
  totalActiveInstitutions: number;
  totalInactiveInstitutions: number;
  totalLinkedUnits: number;
  totalCourses: number;
  totalOffers: number;
}

export interface InstitutionManagementEntry {
  id: string;
  name: string;
  displayName: string | null;
  acronym: string | null;
  slug: string;
  cnpj: string | null;
  isActive: boolean;
  primaryLogoPath: string | null;
  primaryLogoUrl: string | null;
  compactLogoPath: string | null;
  compactLogoUrl: string | null;
  visualIdentityUpdatedAt: string | null;
  unitsCount: number;
  coursesCount: number;
  offersCount: number;
}

export interface InstitutionManagementPageData {
  summary: InstitutionManagementSummary;
  institutions: InstitutionManagementEntry[];
}

function formatSupabaseErrorMessage(context: string, error: PostgrestError | null) {
  if (!error) {
    return context;
  }

  const details = [
    error.message ? `message=${error.message}` : null,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null
  ].filter(Boolean);

  return details.length ? `${context} (${details.join(" | ")})` : context;
}

function formatCnpj(cnpj: string | null) {
  if (!cnpj) {
    return null;
  }

  const digits = cnpj.replace(/\D+/g, "");

  if (digits.length !== 14) {
    return cnpj;
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export async function getInstitutionManagementPageData(): Promise<InstitutionManagementPageData> {
  const supabase = createSupabaseAdminClient();
  const [institutionsResult, unitsResult, coursesResult, offersResult] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("unidades").select("id, instituicao_id"),
    supabase.from("cursos").select("id, instituicao_id"),
    supabase.from("ofertas_curso_unidade").select("id, instituicao_id")
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar as unidades.", unitsResult.error)
    );
  }

  if (coursesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os cursos.", coursesResult.error)
    );
  }

  if (offersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as ofertas de curso por unidade.",
        offersResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const unitRows = (unitsResult.data ?? []) as Pick<UnitRow, "id" | "instituicao_id">[];
  const courseRows = (coursesResult.data ?? []) as Pick<CourseRow, "id" | "instituicao_id">[];
  const offerRows = (offersResult.data ?? []) as Pick<OfferRow, "id" | "instituicao_id">[];

  const unitsCountByInstitutionId = new Map<string, number>();
  const coursesCountByInstitutionId = new Map<string, number>();
  const offersCountByInstitutionId = new Map<string, number>();

  for (const unitRow of unitRows) {
    if (!unitRow.instituicao_id) {
      continue;
    }

    unitsCountByInstitutionId.set(
      unitRow.instituicao_id,
      (unitsCountByInstitutionId.get(unitRow.instituicao_id) ?? 0) + 1
    );
  }

  for (const courseRow of courseRows) {
    coursesCountByInstitutionId.set(
      courseRow.instituicao_id,
      (coursesCountByInstitutionId.get(courseRow.instituicao_id) ?? 0) + 1
    );
  }

  for (const offerRow of offerRows) {
    offersCountByInstitutionId.set(
      offerRow.instituicao_id,
      (offersCountByInstitutionId.get(offerRow.instituicao_id) ?? 0) + 1
    );
  }

  const institutions = await Promise.all(
    institutionRows.map(async (institutionRow) => {
      const [primaryLogoUrl, compactLogoUrl] = await Promise.all([
        getInstitutionBrandingDownloadUrl(institutionRow.logo_principal_path),
        getInstitutionBrandingDownloadUrl(institutionRow.logo_compacta_path)
      ]);

      return {
        id: institutionRow.id,
        name: institutionRow.nome,
        displayName: institutionRow.nome_exibicao?.trim() || null,
        acronym: institutionRow.sigla,
        slug: institutionRow.slug,
        cnpj: formatCnpj(institutionRow.cnpj),
        isActive: institutionRow.ativo,
        primaryLogoPath: institutionRow.logo_principal_path,
        primaryLogoUrl,
        compactLogoPath: institutionRow.logo_compacta_path,
        compactLogoUrl,
        visualIdentityUpdatedAt: institutionRow.identidade_visual_atualizada_em,
        unitsCount: unitsCountByInstitutionId.get(institutionRow.id) ?? 0,
        coursesCount: coursesCountByInstitutionId.get(institutionRow.id) ?? 0,
        offersCount: offersCountByInstitutionId.get(institutionRow.id) ?? 0
      } satisfies InstitutionManagementEntry;
    })
  );

  return {
    summary: {
      totalInstitutions: institutionRows.length,
      totalActiveInstitutions: institutionRows.filter((institutionRow) => institutionRow.ativo)
        .length,
      totalInactiveInstitutions: institutionRows.filter((institutionRow) => !institutionRow.ativo)
        .length,
      totalLinkedUnits: unitRows.filter((unitRow) => unitRow.instituicao_id !== null).length,
      totalCourses: courseRows.length,
      totalOffers: offerRows.length
    },
    institutions
  };
}
