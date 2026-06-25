alter table public.instituicoes
  add column if not exists nome_exibicao text,
  add column if not exists logo_principal_path text,
  add column if not exists logo_compacta_path text,
  add column if not exists identidade_visual_atualizada_em timestamptz;
