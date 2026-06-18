begin;

alter table public.documentos_aluno
  add column if not exists oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict;

alter table public.documentos_aluno
  add column if not exists documento_obrigatorio_curso_id uuid references public.documentos_obrigatorios_curso (id) on delete restrict;

create index if not exists idx_documentos_aluno_oferta_curso_unidade_id
  on public.documentos_aluno (oferta_curso_unidade_id);

create index if not exists idx_documentos_aluno_documento_obrigatorio_curso_id
  on public.documentos_aluno (documento_obrigatorio_curso_id);

alter table public.documentos_aluno
  drop constraint if exists documentos_aluno_tipo_check;

alter table public.documentos_aluno
  add constraint documentos_aluno_tipo_check
  check (tipo in ('carteira_vacinacao', 'tce', 'obrigatorio_generico'));

alter table public.documentos_aluno
  drop constraint if exists documentos_aluno_tipo_relacao_check;

alter table public.documentos_aluno
  add constraint documentos_aluno_tipo_relacao_check
  check (
    (
      tipo = 'carteira_vacinacao'
      and matricula_turma_id is null
      and area_estagio_id is null
    )
    or (
      tipo = 'tce'
      and matricula_turma_id is not null
      and area_estagio_id is not null
    )
    or (
      tipo = 'obrigatorio_generico'
      and matricula_turma_id is null
      and area_estagio_id is null
      and documento_obrigatorio_curso_id is not null
    )
  );

create unique index if not exists idx_documentos_aluno_generico_ativo_uk
  on public.documentos_aluno (aluno_id, documento_obrigatorio_curso_id)
  where tipo = 'obrigatorio_generico'
    and ativo = true
    and documento_obrigatorio_curso_id is not null;

commit;
