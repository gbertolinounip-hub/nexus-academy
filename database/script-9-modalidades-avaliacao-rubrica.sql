begin;

alter table public.modelos_avaliacao_curso
  add column if not exists modalidade text;

update public.modelos_avaliacao_curso
set modalidade = 'descritiva'
where modalidade is null;

alter table public.modelos_avaliacao_curso
  alter column modalidade set default 'descritiva';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'modelos_avaliacao_curso_modalidade_check'
      and conrelid = 'public.modelos_avaliacao_curso'::regclass
  ) then
    alter table public.modelos_avaliacao_curso
      add constraint modelos_avaliacao_curso_modalidade_check
      check (modalidade in ('descritiva', 'rubrica'));
  end if;
end;
$$;

alter table public.modelos_avaliacao_curso
  alter column modalidade set not null;

create table if not exists public.opcoes_criterio_modelo_avaliacao (
  id uuid primary key default gen_random_uuid(),
  criterio_modelo_avaliacao_id uuid not null references public.criterios_modelo_avaliacao (id) on delete cascade,
  rotulo text not null,
  descricao text,
  valor_nota numeric(5,2) not null,
  ordem integer not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opcoes_criterio_modelo_avaliacao_valor_check
    check (valor_nota >= 0 and valor_nota <= 10),
  constraint opcoes_criterio_modelo_avaliacao_ordem_check
    check (ordem > 0)
);

create index if not exists idx_opcoes_criterio_modelo_avaliacao_criterio_id
  on public.opcoes_criterio_modelo_avaliacao (criterio_modelo_avaliacao_id);

create index if not exists idx_opcoes_criterio_modelo_avaliacao_criterio_ativo_ordem
  on public.opcoes_criterio_modelo_avaliacao (criterio_modelo_avaliacao_id, ativo, ordem);

create unique index if not exists idx_opcoes_criterio_modelo_avaliacao_ordem_uk
  on public.opcoes_criterio_modelo_avaliacao (criterio_modelo_avaliacao_id, ordem);

alter table public.itens_avaliados
  add column if not exists criterio_modelo_avaliacao_id uuid references public.criterios_modelo_avaliacao (id) on delete set null;

alter table public.itens_avaliados
  add column if not exists opcao_criterio_modelo_avaliacao_id uuid references public.opcoes_criterio_modelo_avaliacao (id) on delete set null;

alter table public.itens_avaliados
  add column if not exists opcao_rotulo_snapshot text;

alter table public.itens_avaliados
  add column if not exists opcao_descricao_snapshot text;

alter table public.itens_avaliados
  add column if not exists opcao_valor_snapshot numeric(5,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itens_avaliados_opcao_valor_snapshot_check'
      and conrelid = 'public.itens_avaliados'::regclass
  ) then
    alter table public.itens_avaliados
      add constraint itens_avaliados_opcao_valor_snapshot_check
      check (
        opcao_valor_snapshot is null
        or (opcao_valor_snapshot >= 0 and opcao_valor_snapshot <= 10)
      );
  end if;
end;
$$;

create index if not exists idx_itens_avaliados_criterio_modelo_avaliacao_id
  on public.itens_avaliados (criterio_modelo_avaliacao_id);

create index if not exists idx_itens_avaliados_opcao_criterio_modelo_avaliacao_id
  on public.itens_avaliados (opcao_criterio_modelo_avaliacao_id);

alter table public.avaliacoes
  add column if not exists modelo_avaliacao_curso_id uuid references public.modelos_avaliacao_curso (id) on delete restrict;

alter table public.avaliacoes
  add column if not exists modalidade_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'avaliacoes_modalidade_snapshot_check'
      and conrelid = 'public.avaliacoes'::regclass
  ) then
    alter table public.avaliacoes
      add constraint avaliacoes_modalidade_snapshot_check
      check (
        modalidade_snapshot is null
        or modalidade_snapshot in ('descritiva', 'rubrica')
      );
  end if;
end;
$$;

create index if not exists idx_avaliacoes_modelo_avaliacao_curso_id
  on public.avaliacoes (modelo_avaliacao_curso_id);

drop trigger if exists trg_opcoes_criterio_modelo_avaliacao_touch_updated_at on public.opcoes_criterio_modelo_avaliacao;
create trigger trg_opcoes_criterio_modelo_avaliacao_touch_updated_at
before update on public.opcoes_criterio_modelo_avaliacao
for each row execute function public.touch_updated_at();

commit;
