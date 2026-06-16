alter table public.modelos_avaliacao_curso
  add column if not exists padrao_lancamento boolean not null default false;

create unique index if not exists idx_modelos_avaliacao_curso_padrao_lancamento_uk
  on public.modelos_avaliacao_curso (curso_id)
  where padrao_lancamento = true;

with cursos_com_um_modelo_ativo as (
  select
    curso_id,
    max(id) as modelo_padrao_id
  from public.modelos_avaliacao_curso
  where ativo = true
  group by curso_id
  having count(*) = 1
)
update public.modelos_avaliacao_curso modelo
set padrao_lancamento = true
from cursos_com_um_modelo_ativo curso_unico
where modelo.id = curso_unico.modelo_padrao_id
  and modelo.padrao_lancamento = false;
