-- Script 1 - migracao aditiva para arquitetura multi-institucional e multicurso
-- Objetivo:
-- 1. Criar tabelas estruturais novas.
-- 2. Adicionar colunas nullable nas tabelas existentes.
-- 3. Criar indices e constraints basicas seguras.
-- 4. Nao executar backfill nesta etapa.
-- 5. Nao alterar RLS/policies nesta etapa.
-- 6. Nao remover colunas legadas nem quebrar o fluxo atual da Fisioterapia.

create table if not exists public.instituicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text,
  slug text not null,
  cnpj text,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_instituicoes_slug_uk
  on public.instituicoes (slug);

create index if not exists idx_instituicoes_ativo
  on public.instituicoes (ativo);

create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references public.instituicoes (id) on delete restrict,
  codigo text not null,
  nome text not null,
  slug text not null,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_cursos_instituicao_codigo_uk
  on public.cursos (instituicao_id, codigo);

create unique index if not exists idx_cursos_instituicao_slug_uk
  on public.cursos (instituicao_id, slug);

create index if not exists idx_cursos_instituicao_ativo
  on public.cursos (instituicao_id, ativo);

create table if not exists public.ofertas_curso_unidade (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references public.instituicoes (id) on delete restrict,
  unidade_id uuid not null references public.unidades (id) on delete restrict,
  curso_id uuid not null references public.cursos (id) on delete restrict,
  codigo text,
  nome_exibicao text,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ofertas_curso_unidade_unidade_curso_uk
  on public.ofertas_curso_unidade (unidade_id, curso_id);

create unique index if not exists idx_ofertas_curso_unidade_instituicao_codigo_uk
  on public.ofertas_curso_unidade (instituicao_id, codigo)
  where codigo is not null and nullif(trim(codigo), '') is not null;

create index if not exists idx_ofertas_curso_unidade_instituicao_ativo
  on public.ofertas_curso_unidade (instituicao_id, ativo);

create index if not exists idx_ofertas_curso_unidade_unidade_ativo
  on public.ofertas_curso_unidade (unidade_id, ativo);

create index if not exists idx_ofertas_curso_unidade_curso_ativo
  on public.ofertas_curso_unidade (curso_id, ativo);

create table if not exists public.usuarios_papeis_contexto (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  perfil_id smallint not null references public.perfis (id) on delete restrict,
  instituicao_id uuid references public.instituicoes (id) on delete restrict,
  curso_id uuid references public.cursos (id) on delete restrict,
  oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict,
  principal boolean not null default false,
  ativo boolean not null default true,
  inicio_em date,
  fim_em date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_papeis_contexto_periodo_check
    check (fim_em is null or inicio_em is null or fim_em >= inicio_em)
);

create index if not exists idx_usuarios_papeis_contexto_usuario_ativo
  on public.usuarios_papeis_contexto (usuario_id, ativo);

create index if not exists idx_usuarios_papeis_contexto_perfil_ativo
  on public.usuarios_papeis_contexto (perfil_id, ativo);

create index if not exists idx_usuarios_papeis_contexto_instituicao_ativo
  on public.usuarios_papeis_contexto (instituicao_id, ativo);

create index if not exists idx_usuarios_papeis_contexto_curso_ativo
  on public.usuarios_papeis_contexto (curso_id, ativo);

create index if not exists idx_usuarios_papeis_contexto_oferta_ativo
  on public.usuarios_papeis_contexto (oferta_curso_unidade_id, ativo);

create unique index if not exists idx_usuarios_papeis_contexto_principal_uk
  on public.usuarios_papeis_contexto (usuario_id)
  where principal = true;

create table if not exists public.modelos_avaliacao_curso (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete restrict,
  codigo text not null,
  nome text not null,
  descricao text,
  versao integer not null default 1,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modelos_avaliacao_curso_versao_check
    check (versao > 0)
);

create unique index if not exists idx_modelos_avaliacao_curso_codigo_versao_uk
  on public.modelos_avaliacao_curso (curso_id, codigo, versao);

create index if not exists idx_modelos_avaliacao_curso_curso_ativo
  on public.modelos_avaliacao_curso (curso_id, ativo);

create table if not exists public.grupos_modelo_avaliacao (
  id uuid primary key default gen_random_uuid(),
  modelo_avaliacao_curso_id uuid not null references public.modelos_avaliacao_curso (id) on delete cascade,
  codigo text not null,
  nome text not null,
  ordem smallint not null,
  peso_percentual numeric(5,2) not null,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grupos_modelo_avaliacao_peso_check
    check (peso_percentual > 0 and peso_percentual <= 100),
  constraint grupos_modelo_avaliacao_ordem_check
    check (ordem > 0)
);

create unique index if not exists idx_grupos_modelo_avaliacao_ordem_uk
  on public.grupos_modelo_avaliacao (modelo_avaliacao_curso_id, ordem);

create unique index if not exists idx_grupos_modelo_avaliacao_codigo_uk
  on public.grupos_modelo_avaliacao (modelo_avaliacao_curso_id, codigo);

create index if not exists idx_grupos_modelo_avaliacao_modelo_ativo
  on public.grupos_modelo_avaliacao (modelo_avaliacao_curso_id, ativo);

create table if not exists public.criterios_modelo_avaliacao (
  id uuid primary key default gen_random_uuid(),
  grupo_modelo_avaliacao_id uuid not null references public.grupos_modelo_avaliacao (id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text,
  ordem smallint not null,
  peso_percentual numeric(5,2) not null,
  escala_maxima numeric(4,2) not null default 10.00,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint criterios_modelo_avaliacao_peso_check
    check (peso_percentual > 0 and peso_percentual <= 100),
  constraint criterios_modelo_avaliacao_escala_check
    check (escala_maxima > 0),
  constraint criterios_modelo_avaliacao_ordem_check
    check (ordem > 0)
);

create unique index if not exists idx_criterios_modelo_avaliacao_ordem_uk
  on public.criterios_modelo_avaliacao (grupo_modelo_avaliacao_id, ordem);

create unique index if not exists idx_criterios_modelo_avaliacao_codigo_uk
  on public.criterios_modelo_avaliacao (grupo_modelo_avaliacao_id, codigo);

create index if not exists idx_criterios_modelo_avaliacao_grupo_ativo
  on public.criterios_modelo_avaliacao (grupo_modelo_avaliacao_id, ativo);

create table if not exists public.tipos_documento (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tipos_documento_codigo_uk
  on public.tipos_documento (codigo);

create index if not exists idx_tipos_documento_ativo
  on public.tipos_documento (ativo);

create table if not exists public.documentos_obrigatorios_curso (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete restrict,
  tipo_documento_id uuid not null references public.tipos_documento (id) on delete restrict,
  codigo text,
  nome_exibicao text,
  descricao text,
  obrigatorio boolean not null default true,
  ordem smallint,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentos_obrigatorios_curso_ordem_check
    check (ordem is null or ordem > 0)
);

create unique index if not exists idx_documentos_obrigatorios_curso_tipo_uk
  on public.documentos_obrigatorios_curso (curso_id, tipo_documento_id);

create unique index if not exists idx_documentos_obrigatorios_curso_codigo_uk
  on public.documentos_obrigatorios_curso (curso_id, codigo)
  where codigo is not null and nullif(trim(codigo), '') is not null;

create index if not exists idx_documentos_obrigatorios_curso_curso_ativo
  on public.documentos_obrigatorios_curso (curso_id, ativo);

alter table public.unidades
  add column if not exists instituicao_id uuid references public.instituicoes (id) on delete restrict;

create index if not exists idx_unidades_instituicao_id
  on public.unidades (instituicao_id);

alter table public.usuarios
  add column if not exists contexto_padrao_id uuid references public.usuarios_papeis_contexto (id) on delete set null;

create index if not exists idx_usuarios_contexto_padrao_id
  on public.usuarios (contexto_padrao_id);

alter table public.alunos
  add column if not exists curso_id uuid references public.cursos (id) on delete restrict;

alter table public.alunos
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_alunos_curso_id
  on public.alunos (curso_id);

create index if not exists idx_alunos_oferta_curso_unidade_id
  on public.alunos (oferta_curso_unidade_id);

alter table public.semestres
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_semestres_oferta_curso_unidade_id
  on public.semestres (oferta_curso_unidade_id);

alter table public.turmas
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_turmas_oferta_curso_unidade_id
  on public.turmas (oferta_curso_unidade_id);

alter table public.matriculas_turma
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_matriculas_turma_oferta_curso_unidade_id
  on public.matriculas_turma (oferta_curso_unidade_id);

alter table public.avaliacoes
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

alter table public.avaliacoes
  add column if not exists modelo_avaliacao_curso_id uuid references public.modelos_avaliacao_curso (id) on delete restrict;

create index if not exists idx_avaliacoes_oferta_curso_unidade_id
  on public.avaliacoes (oferta_curso_unidade_id);

create index if not exists idx_avaliacoes_modelo_avaliacao_curso_id
  on public.avaliacoes (modelo_avaliacao_curso_id);

alter table public.ausencias
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_ausencias_oferta_curso_unidade_id
  on public.ausencias (oferta_curso_unidade_id);

alter table public.liberacoes_excepcionais
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

create index if not exists idx_liberacoes_excepcionais_oferta_curso_unidade_id
  on public.liberacoes_excepcionais (oferta_curso_unidade_id);

alter table public.documentos_aluno
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

alter table public.documentos_aluno
  add column if not exists documento_obrigatorio_curso_id uuid references public.documentos_obrigatorios_curso (id) on delete restrict;

create index if not exists idx_documentos_aluno_oferta_curso_unidade_id
  on public.documentos_aluno (oferta_curso_unidade_id);

create index if not exists idx_documentos_aluno_documento_obrigatorio_curso_id
  on public.documentos_aluno (documento_obrigatorio_curso_id);

drop trigger if exists trg_instituicoes_touch_updated_at on public.instituicoes;
create trigger trg_instituicoes_touch_updated_at
before update on public.instituicoes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_cursos_touch_updated_at on public.cursos;
create trigger trg_cursos_touch_updated_at
before update on public.cursos
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ofertas_curso_unidade_touch_updated_at on public.ofertas_curso_unidade;
create trigger trg_ofertas_curso_unidade_touch_updated_at
before update on public.ofertas_curso_unidade
for each row execute function public.touch_updated_at();

drop trigger if exists trg_usuarios_papeis_contexto_touch_updated_at on public.usuarios_papeis_contexto;
create trigger trg_usuarios_papeis_contexto_touch_updated_at
before update on public.usuarios_papeis_contexto
for each row execute function public.touch_updated_at();

drop trigger if exists trg_modelos_avaliacao_curso_touch_updated_at on public.modelos_avaliacao_curso;
create trigger trg_modelos_avaliacao_curso_touch_updated_at
before update on public.modelos_avaliacao_curso
for each row execute function public.touch_updated_at();

drop trigger if exists trg_grupos_modelo_avaliacao_touch_updated_at on public.grupos_modelo_avaliacao;
create trigger trg_grupos_modelo_avaliacao_touch_updated_at
before update on public.grupos_modelo_avaliacao
for each row execute function public.touch_updated_at();

drop trigger if exists trg_criterios_modelo_avaliacao_touch_updated_at on public.criterios_modelo_avaliacao;
create trigger trg_criterios_modelo_avaliacao_touch_updated_at
before update on public.criterios_modelo_avaliacao
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tipos_documento_touch_updated_at on public.tipos_documento;
create trigger trg_tipos_documento_touch_updated_at
before update on public.tipos_documento
for each row execute function public.touch_updated_at();

drop trigger if exists trg_documentos_obrigatorios_curso_touch_updated_at on public.documentos_obrigatorios_curso;
create trigger trg_documentos_obrigatorios_curso_touch_updated_at
before update on public.documentos_obrigatorios_curso
for each row execute function public.touch_updated_at();

-- Tabelas clinicas revisadas para fase futura:
-- 1. public.casos_clinicos: forte candidata a receber oferta_curso_unidade_id.
-- 2. public.registros_clinicos: forte candidata a receber oferta_curso_unidade_id.
-- 3. public.notificacoes_clinicas: opcional, pode herdar o contexto por caso clinico.
-- 4. public.casos_clinicos_horarios: nao precisa de coluna propria se continuar derivando do caso clinico.
-- 5. public.pacientes_clinica: pode permanecer escopada por unidade, salvo decisao futura em contrario.
