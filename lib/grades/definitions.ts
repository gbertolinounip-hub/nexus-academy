import type { RubricCriterionDefinition, RubricGroupDefinition } from "@/types/domain";

export const rubricGroups: RubricGroupDefinition[] = [
  {
    id: "tomada_decisoes",
    name: "Tomada de Decisões",
    weightPercentage: 10,
    order: 1
  },
  {
    id: "atencao_saude",
    name: "Atenção à Saúde",
    weightPercentage: 10,
    order: 2
  },
  {
    id: "comunicacao",
    name: "Comunicação",
    weightPercentage: 5,
    order: 3
  },
  {
    id: "lideranca",
    name: "Liderança",
    weightPercentage: 5,
    order: 4
  },
  {
    id: "educacao_permanente",
    name: "Educação Permanente",
    weightPercentage: 70,
    order: 5
  }
];

export const rubricCriteria: RubricCriterionDefinition[] = [
  {
    id: "objetivos_terapeuticos",
    groupId: "tomada_decisoes",
    name: "Estabelece objetivos terapêuticos",
    description: "Define objetivos terapêuticos adequados ao caso.",
    weightPercentage: 3,
    order: 1,
    maxScore: 10
  },
  {
    id: "tecnicas_adequadas",
    groupId: "tomada_decisoes",
    name: "Indica as técnicas terapêuticas adequadas",
    description: "Seleciona técnicas coerentes com o plano terapêutico.",
    weightPercentage: 3,
    order: 2,
    maxScore: 10
  },
  {
    id: "justificativa_cientifica",
    groupId: "tomada_decisoes",
    name: "Justifica científica e racionalmente o emprego das técnicas",
    description: "Apresenta fundamento clínico e científico.",
    weightPercentage: 3,
    order: 3,
    maxScore: 10
  },
  {
    id: "iniciativa",
    groupId: "tomada_decisoes",
    name: "Apresenta iniciativa",
    description: "Demonstra proatividade e autonomia supervisionada.",
    weightPercentage: 1,
    order: 4,
    maxScore: 10
  },
  {
    id: "manuseio_equipamentos",
    groupId: "atencao_saude",
    name: "Manuseio durante atendimentos, avaliações, uso de equipamentos e interpretação dos exames complementares",
    description: "Executa o cuidado com segurança técnica.",
    weightPercentage: 5,
    order: 1,
    maxScore: 10
  },
  {
    id: "etica_bioetica",
    groupId: "atencao_saude",
    name: "Ética/Bioética",
    description: "Age de forma ética com pacientes e equipe.",
    weightPercentage: 1,
    order: 2,
    maxScore: 10
  },
  {
    id: "tempo_avaliacao",
    groupId: "atencao_saude",
    name: "Usa tempo adequado para a avaliação do paciente",
    description: "Organiza o tempo clínico de forma eficiente.",
    weightPercentage: 1,
    order: 3,
    maxScore: 10
  },
  {
    id: "diagnostico_cineticofuncional",
    groupId: "atencao_saude",
    name: "Chega a diagnóstico cineticofuncional adequadamente",
    description: "Constrói raciocínio diagnóstico adequado.",
    weightPercentage: 3,
    order: 4,
    maxScore: 10
  },
  {
    id: "escrita_clinica",
    groupId: "comunicacao",
    name: "Apresenta habilidades de escrita (avaliação e evolução dos pacientes / trabalhos acadêmicos)",
    description: "Documenta com clareza a prática clínica e acadêmica.",
    weightPercentage: 4,
    order: 1,
    maxScore: 10
  },
  {
    id: "esclarecimento_tratamento",
    groupId: "comunicacao",
    name: "Esclarece o processo de tratamento ao doente e/ou familiares",
    description: "Explica o cuidado de modo compreensível.",
    weightPercentage: 1,
    order: 2,
    maxScore: 10
  },
  {
    id: "trabalho_equipe",
    groupId: "lideranca",
    name: "Trabalha bem em equipe (relacionamento interpessoal, respeito à hierarquia e organização do setor)",
    description: "Atua bem com colegas, docentes e setor.",
    weightPercentage: 4,
    order: 1,
    maxScore: 10
  },
  {
    id: "compromisso_profissional",
    groupId: "lideranca",
    name: "Compromisso com a profissão, pacientes, colegas, IES e clínica-escola",
    description: "Demonstra responsabilidade profissional.",
    weightPercentage: 1,
    order: 2,
    maxScore: 10
  },
  {
    id: "trabalhos_seminarios",
    groupId: "educacao_permanente",
    name: "Prepara e apresenta os trabalhos e seminários adequadamente",
    description: "Entrega e apresenta seminários com qualidade.",
    weightPercentage: 10,
    order: 1,
    maxScore: 10
  },
  {
    id: "provas_teoricas",
    groupId: "educacao_permanente",
    name: "Nota(s) da(s) prova(s) teórica(s)",
    description: "Representa o desempenho em avaliações teóricas.",
    weightPercentage: 30,
    order: 2,
    maxScore: 10
  },
  {
    id: "atividade_pratica",
    groupId: "educacao_permanente",
    name: "Nota da atividade prática de atendimento",
    description: "Representa o desempenho prático assistencial.",
    weightPercentage: 30,
    order: 3,
    maxScore: 10
  }
];

function validateRubric() {
  const totalGroupWeight = rubricGroups.reduce(
    (sum, group) => sum + group.weightPercentage,
    0
  );

  if (totalGroupWeight !== 100) {
    throw new Error("A soma dos grupos de avaliação deve ser 100%.");
  }

  for (const group of rubricGroups) {
    const criteriaWeight = rubricCriteria
      .filter((criterion) => criterion.groupId === group.id)
      .reduce((sum, criterion) => sum + criterion.weightPercentage, 0);

    if (criteriaWeight !== group.weightPercentage) {
      throw new Error(
        `A soma dos critérios do grupo ${group.name} deve ser ${group.weightPercentage}%.`
      );
    }
  }
}

validateRubric();

export const rubricCriteriaById = new Map(
  rubricCriteria.map((criterion) => [criterion.id, criterion])
);

export const rubricGroupsById = new Map(
  rubricGroups.map((group) => [group.id, group])
);




