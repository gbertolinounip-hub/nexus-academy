begin;

alter table public.semestres
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_semestres_oferta_curso_unidade_id
  on public.semestres (oferta_curso_unidade_id);

drop index if exists public.idx_semestres_unidade_codigo_uk;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'semestres_codigo_key'
      and conrelid = 'public.semestres'::regclass
  ) then
    alter table public.semestres
      drop constraint semestres_codigo_key;
  end if;
end;
$$;

create unique index if not exists idx_semestres_oferta_codigo_uk
  on public.semestres (oferta_curso_unidade_id, codigo)
  where oferta_curso_unidade_id is not null;

create unique index if not exists idx_semestres_unidade_codigo_legacy_uk
  on public.semestres (unidade_id, codigo)
  where oferta_curso_unidade_id is null;

commit;

-- Diagnostico manual opcional antes da aplicacao:
-- select
--   unidade_id,
--   oferta_curso_unidade_id,
--   codigo,
--   count(*) as total
-- from public.semestres
-- group by 1, 2, 3
-- having count(*) > 1;
