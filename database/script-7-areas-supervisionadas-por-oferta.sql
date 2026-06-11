-- Objetivo:
-- 1. Permitir áreas supervisionadas específicas por oferta do curso na unidade.
-- 2. Preservar áreas legadas globais da Fisioterapia sem apagar histórico.
-- 3. Evitar colisões de código/nome/ordem entre ofertas diferentes.

alter table public.areas_estagio
  add column if not exists oferta_curso_unidade_id uuid
    references public.ofertas_curso_unidade (id)
    on delete restrict;

alter table public.areas_estagio
  drop constraint if exists areas_estagio_codigo_key;

alter table public.areas_estagio
  drop constraint if exists areas_estagio_nome_key;

alter table public.areas_estagio
  drop constraint if exists areas_estagio_ordem_uk;

create unique index if not exists idx_areas_estagio_codigo_legacy_uk
  on public.areas_estagio (codigo)
  where oferta_curso_unidade_id is null;

create unique index if not exists idx_areas_estagio_codigo_oferta_uk
  on public.areas_estagio (oferta_curso_unidade_id, codigo)
  where oferta_curso_unidade_id is not null;

create unique index if not exists idx_areas_estagio_nome_legacy_uk
  on public.areas_estagio (nome)
  where oferta_curso_unidade_id is null;

create unique index if not exists idx_areas_estagio_nome_oferta_uk
  on public.areas_estagio (oferta_curso_unidade_id, nome)
  where oferta_curso_unidade_id is not null;

create unique index if not exists idx_areas_estagio_ordem_legacy_uk
  on public.areas_estagio (bloco_id, ordem)
  where oferta_curso_unidade_id is null;

create unique index if not exists idx_areas_estagio_ordem_oferta_uk
  on public.areas_estagio (oferta_curso_unidade_id, bloco_id, ordem)
  where oferta_curso_unidade_id is not null;

create index if not exists idx_areas_estagio_oferta_bloco_ordem
  on public.areas_estagio (oferta_curso_unidade_id, ativa, bloco_id, ordem);
