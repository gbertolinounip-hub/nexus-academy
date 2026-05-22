export const studentDashboardQueryExample = `
select *
from public.calcular_resumo_semestral(:matricula_turma_id);
`;

export const professorLinkedStudentsQueryExample = `
select
  v.matricula_turma_id,
  u.nome_completo,
  a.matricula
from public.vinculos_professor_aluno v
join public.matriculas_turma mt on mt.id = v.matricula_turma_id
join public.alunos a on a.usuario_id = mt.aluno_id
join public.usuarios u on u.id = a.usuario_id
where v.professor_id = :professor_id
  and v.ativo = true;
`;

export const auditTrailQueryExample = `
select *
from public.historico_alteracoes
order by created_at desc
limit 100;
`;
