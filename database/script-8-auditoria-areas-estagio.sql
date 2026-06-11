-- Objetivo:
-- 1. Corrigir o erro "case not found" ao auditar inserts/updates em areas_estagio.
-- 2. Preservar a auditoria existente sem alterar policies ou histórico legado.
-- 3. Resolver a unidade da auditoria por oferta quando a área supervisionada já estiver
--    vinculada a uma oferta, com fallback seguro para o ator autenticado.

create or replace function private.resolve_audit_unit_id(
  p_table_name text,
  p_record_data jsonb,
  p_actor_unit_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_unit_id uuid;
begin
  if p_record_data is null then
    return p_actor_unit_id;
  end if;

  begin
    resolved_unit_id :=
      nullif(trim(coalesce(p_record_data ->> 'unidade_id', '')), '')::uuid;
  exception
    when invalid_text_representation then
      resolved_unit_id := null;
  end;

  if resolved_unit_id is not null then
    return resolved_unit_id;
  end if;

  case p_table_name
    when 'usuarios' then
      select u.unidade_id
      into resolved_unit_id
      from public.usuarios u
      where u.id = nullif(p_record_data ->> 'id', '')::uuid
      limit 1;

    when 'alunos' then
      select coalesce(a.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.alunos a
      left join public.usuarios u on u.id = a.usuario_id
      where a.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'professores' then
      select coalesce(p.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.professores p
      left join public.usuarios u on u.id = p.usuario_id
      where p.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'coordenadores' then
      select coalesce(c.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.coordenadores c
      left join public.usuarios u on u.id = c.usuario_id
      where c.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'semestres' then
      select s.unidade_id
      into resolved_unit_id
      from public.semestres s
      where s.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'semestre_id', '')::uuid
      )
      limit 1;

    when 'turmas' then
      select s.unidade_id
      into resolved_unit_id
      from public.turmas t
      join public.semestres s on s.id = t.semestre_id
      where t.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'turma_id', '')::uuid
      )
      limit 1;

    when 'matriculas_turma', 'ausencias', 'vinculos_professor_aluno' then
      select s.unidade_id
      into resolved_unit_id
      from public.matriculas_turma m
      join public.turmas t on t.id = m.turma_id
      join public.semestres s on s.id = t.semestre_id
      where m.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
      )
      limit 1;

    when 'blocos_estagio' then
      resolved_unit_id := p_actor_unit_id;

    when 'areas_estagio' then
      select ocu.unidade_id
      into resolved_unit_id
      from public.areas_estagio a
      left join public.ofertas_curso_unidade ocu on ocu.id = a.oferta_curso_unidade_id
      where a.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'area_estagio_id', '')::uuid
      )
      limit 1;

    when 'professor_areas_estagio' then
      select coalesce(p.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.professores p
      left join public.usuarios u on u.id = p.usuario_id
      where p.usuario_id = nullif(p_record_data ->> 'professor_id', '')::uuid
      limit 1;

    when 'avaliacoes' then
      select s.unidade_id
      into resolved_unit_id
      from public.semestres s
      where s.id = nullif(p_record_data ->> 'semestre_id', '')::uuid
      limit 1;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.matriculas_turma m
        join public.turmas t on t.id = m.turma_id
        join public.semestres s on s.id = t.semestre_id
        where m.id = nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
        limit 1;
      end if;

    when 'itens_avaliados' then
      select s.unidade_id
      into resolved_unit_id
      from public.avaliacoes a
      join public.semestres s on s.id = a.semestre_id
      where a.id = nullif(p_record_data ->> 'avaliacao_id', '')::uuid
      limit 1;

    when 'pacientes_clinica' then
      select p.unidade_id
      into resolved_unit_id
      from public.pacientes_clinica p
      where p.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'paciente_id', '')::uuid
      )
      limit 1;

    when 'casos_clinicos' then
      select c.unidade_id
      into resolved_unit_id
      from public.casos_clinicos c
      where c.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'caso_clinico_id', '')::uuid
      )
      limit 1;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.semestres s
        where s.id = nullif(p_record_data ->> 'semestre_id', '')::uuid
        limit 1;
      end if;

    when 'casos_clinicos_horarios', 'registros_clinicos', 'notificacoes_clinicas' then
      select c.unidade_id
      into resolved_unit_id
      from public.casos_clinicos c
      where c.id = nullif(p_record_data ->> 'caso_clinico_id', '')::uuid
      limit 1;

    when 'documentos_aluno' then
      select d.unidade_id
      into resolved_unit_id
      from public.documentos_aluno d
      where d.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'documento_id', '')::uuid
      )
      limit 1;

    when 'notificacoes_documentos_aluno' then
      select d.unidade_id
      into resolved_unit_id
      from public.documentos_aluno d
      where d.id = nullif(p_record_data ->> 'documento_id', '')::uuid
      limit 1;
  end case;

  return coalesce(resolved_unit_id, p_actor_unit_id);
end;
$$;
