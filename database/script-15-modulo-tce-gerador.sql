begin;

create table if not exists public.modelos_tce (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes (id) on delete restrict,
  curso_id uuid references public.cursos (id) on delete restrict,
  nome text not null,
  codigo text not null,
  descricao text,
  ativo boolean not null default true,
  template_path text,
  template_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_modelos_tce_codigo_global_uk
  on public.modelos_tce (codigo)
  where instituicao_id is null and curso_id is null;

create unique index if not exists idx_modelos_tce_codigo_instituicao_uk
  on public.modelos_tce (instituicao_id, codigo)
  where instituicao_id is not null and curso_id is null;

create unique index if not exists idx_modelos_tce_codigo_curso_uk
  on public.modelos_tce (curso_id, codigo)
  where curso_id is not null;

create index if not exists idx_modelos_tce_instituicao_ativo
  on public.modelos_tce (instituicao_id, ativo);

create index if not exists idx_modelos_tce_curso_ativo
  on public.modelos_tce (curso_id, ativo);

create table if not exists public.configuracoes_tce_estagio (
  id uuid primary key default gen_random_uuid(),
  modelo_tce_id uuid not null references public.modelos_tce (id) on delete restrict,
  curso_id uuid not null references public.cursos (id) on delete restrict,
  oferta_curso_unidade_id uuid not null references public.ofertas_curso_unidade (id) on delete restrict,
  semestre_id uuid references public.semestres (id) on delete restrict,
  turma_id uuid references public.turmas (id) on delete restrict,
  area_estagio_id uuid not null references public.areas_estagio (id) on delete restrict,
  nome text not null,
  ativo boolean not null default true,
  dados_concedente jsonb not null default '{}'::jsonb,
  dados_vigencia jsonb not null default '{}'::jsonb,
  dados_horario jsonb not null default '{}'::jsonb,
  jornada_diaria text,
  jornada_semanal text,
  jornada_semestral text,
  plano_atividades text,
  cidade_assinatura text,
  data_assinatura date,
  created_by uuid references public.usuarios (id) on delete set null,
  updated_by uuid references public.usuarios (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_configuracoes_tce_estagio_modelo
  on public.configuracoes_tce_estagio (modelo_tce_id);

create index if not exists idx_configuracoes_tce_estagio_curso
  on public.configuracoes_tce_estagio (curso_id);

create index if not exists idx_configuracoes_tce_estagio_oferta
  on public.configuracoes_tce_estagio (oferta_curso_unidade_id);

create index if not exists idx_configuracoes_tce_estagio_area
  on public.configuracoes_tce_estagio (area_estagio_id);

create index if not exists idx_configuracoes_tce_estagio_semestre
  on public.configuracoes_tce_estagio (semestre_id)
  where semestre_id is not null;

create index if not exists idx_configuracoes_tce_estagio_turma
  on public.configuracoes_tce_estagio (turma_id)
  where turma_id is not null;

create index if not exists idx_configuracoes_tce_estagio_oferta_area_ativo
  on public.configuracoes_tce_estagio (oferta_curso_unidade_id, area_estagio_id, ativo);

create unique index if not exists idx_configuracoes_tce_estagio_escopo_ativo_uk
  on public.configuracoes_tce_estagio (
    oferta_curso_unidade_id,
    area_estagio_id,
    coalesce(semestre_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(turma_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where ativo = true;

create table if not exists public.tces_aluno (
  id uuid primary key default gen_random_uuid(),
  configuracao_tce_estagio_id uuid not null references public.configuracoes_tce_estagio (id) on delete cascade,
  aluno_id uuid not null references public.alunos (usuario_id) on delete cascade,
  matricula_turma_id uuid references public.matriculas_turma (id) on delete set null,
  area_estagio_id uuid references public.areas_estagio (id) on delete set null,
  dados_estagiario jsonb not null default '{}'::jsonb,
  configuracao_snapshot jsonb not null default '{}'::jsonb,
  template_version_snapshot text,
  pdf_gerado_path text,
  gerado_em timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tces_aluno_configuracao_aluno_uk
  on public.tces_aluno (configuracao_tce_estagio_id, aluno_id);

create index if not exists idx_tces_aluno_aluno
  on public.tces_aluno (aluno_id, updated_at desc);

create index if not exists idx_tces_aluno_matricula
  on public.tces_aluno (matricula_turma_id)
  where matricula_turma_id is not null;

create index if not exists idx_tces_aluno_area
  on public.tces_aluno (area_estagio_id)
  where area_estagio_id is not null;

create index if not exists idx_tces_aluno_gerado_em
  on public.tces_aluno (gerado_em desc)
  where gerado_em is not null;

drop trigger if exists trg_modelos_tce_touch_updated_at on public.modelos_tce;
create trigger trg_modelos_tce_touch_updated_at
before update on public.modelos_tce
for each row execute function public.touch_updated_at();

drop trigger if exists trg_configuracoes_tce_estagio_touch_updated_at on public.configuracoes_tce_estagio;
create trigger trg_configuracoes_tce_estagio_touch_updated_at
before update on public.configuracoes_tce_estagio
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tces_aluno_touch_updated_at on public.tces_aluno;
create trigger trg_tces_aluno_touch_updated_at
before update on public.tces_aluno
for each row execute function public.touch_updated_at();

drop trigger if exists trg_modelos_tce_audit on public.modelos_tce;
create trigger trg_modelos_tce_audit
after insert or update or delete on public.modelos_tce
for each row execute function public.audit_changes();

drop trigger if exists trg_configuracoes_tce_estagio_audit on public.configuracoes_tce_estagio;
create trigger trg_configuracoes_tce_estagio_audit
after insert or update or delete on public.configuracoes_tce_estagio
for each row execute function public.audit_changes();

drop trigger if exists trg_tces_aluno_audit on public.tces_aluno;
create trigger trg_tces_aluno_audit
after insert or update or delete on public.tces_aluno
for each row execute function public.audit_changes();

commit;
