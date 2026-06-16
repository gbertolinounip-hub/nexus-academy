alter table public.turmas
  add column if not exists periodo_curricular integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'turmas_periodo_curricular_check'
      and conrelid = 'public.turmas'::regclass
  ) then
    alter table public.turmas
      add constraint turmas_periodo_curricular_check
      check (periodo_curricular is null or periodo_curricular > 0);
  end if;
end;
$$;

create index if not exists idx_turmas_periodo_curricular
  on public.turmas (periodo_curricular)
  where periodo_curricular is not null;

create table if not exists public.regras_aplicacao_modelo_avaliacao (
  id uuid primary key default gen_random_uuid(),
  modelo_avaliacao_curso_id uuid not null references public.modelos_avaliacao_curso (id) on delete cascade,
  oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete cascade,
  periodo_curricular integer,
  semestre_id uuid references public.semestres (id) on delete cascade,
  turma_id uuid references public.turmas (id) on delete cascade,
  area_estagio_id uuid references public.areas_estagio (id) on delete cascade,
  prioridade integer not null default 100,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regras_aplicacao_modelo_avaliacao_escopo_check
    check (
      oferta_curso_unidade_id is not null
      or periodo_curricular is not null
      or semestre_id is not null
      or turma_id is not null
      or area_estagio_id is not null
    ),
  constraint regras_aplicacao_modelo_avaliacao_periodo_curricular_check
    check (periodo_curricular is null or periodo_curricular > 0),
  constraint regras_aplicacao_modelo_avaliacao_prioridade_check
    check (prioridade >= 0)
);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_modelo
  on public.regras_aplicacao_modelo_avaliacao (modelo_avaliacao_curso_id);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_oferta
  on public.regras_aplicacao_modelo_avaliacao (oferta_curso_unidade_id);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_periodo_curricular
  on public.regras_aplicacao_modelo_avaliacao (periodo_curricular)
  where periodo_curricular is not null;

create index if not exists idx_regras_aplicacao_modelo_avaliacao_semestre
  on public.regras_aplicacao_modelo_avaliacao (semestre_id);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_turma
  on public.regras_aplicacao_modelo_avaliacao (turma_id);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_area
  on public.regras_aplicacao_modelo_avaliacao (area_estagio_id);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_ativo
  on public.regras_aplicacao_modelo_avaliacao (ativo);

create index if not exists idx_regras_aplicacao_modelo_avaliacao_modelo_ativo_prioridade
  on public.regras_aplicacao_modelo_avaliacao (
    modelo_avaliacao_curso_id,
    ativo,
    prioridade desc,
    updated_at desc
  );

drop trigger if exists trg_regras_aplicacao_modelo_avaliacao_touch_updated_at on public.regras_aplicacao_modelo_avaliacao;
create trigger trg_regras_aplicacao_modelo_avaliacao_touch_updated_at
before update on public.regras_aplicacao_modelo_avaliacao
for each row execute function public.touch_updated_at();
