import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ResolvedSessionDataScope } from "@/lib/auth/data-scope";
import type { Database } from "@/types/database";

type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type ProfessorAreaRow = Database["public"]["Tables"]["professor_areas_estagio"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface VisibleStageAreaCatalog {
  areaRows: AreaRow[];
  usedLegacyAreas: boolean;
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}

function sortStageAreaRows(rows: AreaRow[]) {
  return [...rows].sort((left, right) => {
    const blockDifference = left.bloco_id - right.bloco_id;

    if (blockDifference !== 0) {
      return blockDifference;
    }

    const orderDifference = left.ordem - right.ordem;

    if (orderDifference !== 0) {
      return orderDifference;
    }

    return left.nome.localeCompare(right.nome, "pt-BR");
  });
}

export function buildStageAreaBlocks(input: {
  blockRows: BlockRow[];
  areaRows: AreaRow[];
}) {
  const sortedAreas = sortStageAreaRows(input.areaRows);

  return input.blockRows
    .map((block) => ({
      id: block.id,
      code: block.codigo,
      name: block.nome,
      areas: sortedAreas
        .filter((area) => area.bloco_id === block.id)
        .map((area) => ({
          id: area.id,
          code: area.codigo,
          name: area.nome,
          blockId: block.id,
          blockCode: block.codigo,
          blockName: block.nome
        }))
    }))
    .filter((block) => block.areas.length > 0);
}

async function loadVisibleOfferRows(input: {
  supabase: SupabaseServerClient;
  scope: Pick<ResolvedSessionDataScope, "offerIds">;
  selectedUnitId?: string | null;
  offerRows?: Array<Pick<OfferRow, "id" | "unidade_id" | "curso_id">>;
}) {
  const providedOfferRows = (input.offerRows ?? []) as Array<
    Pick<OfferRow, "id" | "unidade_id" | "curso_id">
  >;

  let fetchedOfferRows = providedOfferRows;

  if (providedOfferRows.length === 0 && input.scope.offerIds.length > 0) {
    const { data, error } = await input.supabase
      .from("ofertas_curso_unidade")
      .select("id, unidade_id, curso_id")
      .in("id", input.scope.offerIds);

    if (error) {
      throw new Error(
        "Houve um problema ao consultar as ofertas acadêmicas visíveis para o contexto atual."
      );
    }

    fetchedOfferRows = (data ?? []) as Array<
      Pick<OfferRow, "id" | "unidade_id" | "curso_id">
    >;
  }

  if (!input.selectedUnitId) {
    return fetchedOfferRows;
  }

  return fetchedOfferRows.filter((offer) => offer.unidade_id === input.selectedUnitId);
}

export async function loadVisibleStageAreaCatalog(input: {
  supabase: SupabaseServerClient;
  scope: Pick<
    ResolvedSessionDataScope,
    "offerIds" | "cursoId" | "restrictToCourse" | "usesLegacyUnitFallback"
  >;
  selectedUnitId?: string | null;
  offerRows?: Array<Pick<OfferRow, "id" | "unidade_id" | "curso_id">>;
  visibleClassRows?: Array<Pick<ClassRow, "area_estagio_id" | "oferta_curso_unidade_id">>;
  professorAreaRows?: Array<Pick<ProfessorAreaRow, "area_estagio_id">>;
}) : Promise<VisibleStageAreaCatalog> {
  const visibleOfferRows = await loadVisibleOfferRows({
    supabase: input.supabase,
    scope: input.scope,
    selectedUnitId: input.selectedUnitId,
    offerRows: input.offerRows
  });
  const visibleOfferIds = visibleOfferRows.map((offer) => offer.id);
  const allowGlobalLegacyAreas =
    visibleOfferIds.length === 0 && input.scope.usesLegacyUnitFallback;

  const legacyAreaIdsFromClasses = uniqueStringValues(
    (input.visibleClassRows ?? [])
      .filter((classRow) => {
        if (!classRow.area_estagio_id) {
          return false;
        }

        if (visibleOfferIds.length === 0) {
          return true;
        }

        return Boolean(
          classRow.oferta_curso_unidade_id &&
            visibleOfferIds.includes(classRow.oferta_curso_unidade_id)
        );
      })
      .map((classRow) => classRow.area_estagio_id)
  );
  const legacyAreaIdsFromProfessors = uniqueStringValues(
    (input.professorAreaRows ?? []).map((row) => row.area_estagio_id)
  );
  const referencedLegacyAreaIds = uniqueStringValues([
    ...legacyAreaIdsFromClasses,
    ...legacyAreaIdsFromProfessors
  ]);

  const [scopedAreaRowsResult, referencedLegacyAreaRowsResult, allLegacyAreaRowsResult] =
    await Promise.all([
      visibleOfferIds.length
        ? input.supabase
            .from("areas_estagio")
            .select("*")
            .in("oferta_curso_unidade_id", visibleOfferIds)
            .eq("ativa", true)
        : Promise.resolve({ data: [], error: null } as const),
      referencedLegacyAreaIds.length
        ? input.supabase
            .from("areas_estagio")
            .select("*")
            .in("id", referencedLegacyAreaIds)
            .eq("ativa", true)
        : Promise.resolve({ data: [], error: null } as const),
      allowGlobalLegacyAreas
        ? input.supabase
            .from("areas_estagio")
            .select("*")
            .is("oferta_curso_unidade_id", null)
            .eq("ativa", true)
        : Promise.resolve({ data: [], error: null } as const)
    ]);

  if (
    scopedAreaRowsResult.error ||
    referencedLegacyAreaRowsResult.error ||
    allLegacyAreaRowsResult.error
  ) {
    throw new Error(
      "Houve um problema ao consultar as áreas supervisionadas visíveis para o contexto atual."
    );
  }

  const mergedRows = new Map<string, AreaRow>();

  for (const areaRow of [
    ...((scopedAreaRowsResult.data ?? []) as AreaRow[]),
    ...((referencedLegacyAreaRowsResult.data ?? []) as AreaRow[]),
    ...((allLegacyAreaRowsResult.data ?? []) as AreaRow[])
  ]) {
    mergedRows.set(areaRow.id, areaRow);
  }

  const sortedRows = sortStageAreaRows(Array.from(mergedRows.values()));
  const usedLegacyAreas = sortedRows.some(
    (areaRow) => areaRow.oferta_curso_unidade_id === null
  );

  return {
    areaRows: sortedRows,
    usedLegacyAreas
  };
}
