import type {
  AbsenceRecord,
  AuditEntry,
  ClassSummary,
  CoordinatorRecord,
  EvaluationLaunch,
  ProfessorRecord,
  SemesterSummary,
  SessionUser,
  StudentRecord
} from "@/types/domain";

export const currentSemester: SemesterSummary = {
  id: "sem-2026-1",
  code: "2026.1",
  name: "2026/1",
  startsAt: "2026-02-01",
  endsAt: "2026-06-30"
};

export const currentClass: ClassSummary = {
  id: "turma-clinica-a",
  code: "EST-CLIN-A",
  name: "Estágio Supervisionado - Clínica Escola A",
  internshipArea: "Clínica Escola"
};

export const demoSessions: Record<SessionUser["role"], SessionUser> = {
  aluno: {
    id: "stu-ana",
    name: "Ana Paula Souza",
    email: "ana.paula@ies.edu.br",
    role: "aluno"
  },
  professor: {
    id: "prf-juliana",
    name: "Dra. Juliana Martins",
    email: "juliana.martins@ies.edu.br",
    role: "professor"
  },
  secretaria: {
    id: "sec-luana",
    name: "Luana Ferreira",
    email: "luana.ferreira@ies.edu.br",
    role: "secretaria"
  },
  coordenador: {
    id: "coord-marcelo",
    name: "Prof. Marcelo Carvalho",
    email: "marcelo.carvalho@ies.edu.br",
    role: "coordenador"
  },
  coordenador_master: {
    id: "coord-master-ana",
    name: "Profa. Ana Beatriz Gomes",
    email: "ana.gomes@ies.edu.br",
    role: "coordenador_master"
  }
};

export const students: StudentRecord[] = [
  {
    id: "stu-ana",
    enrollmentId: "mat-ana-2026-1",
    registration: "202300101",
    name: "Ana Paula Souza",
    email: "ana.paula@ies.edu.br",
    cellphone: "(11) 99999-1001",
    course: "Fisioterapia",
    semesterId: currentSemester.id,
    classId: currentClass.id,
    assignedProfessorIds: ["prf-juliana"]
  },
  {
    id: "stu-bruno",
    enrollmentId: "mat-bruno-2026-1",
    registration: "202300118",
    name: "Bruno Henrique Lima",
    email: "bruno.lima@ies.edu.br",
    cellphone: "(11) 99999-1018",
    course: "Fisioterapia",
    semesterId: currentSemester.id,
    classId: currentClass.id,
    assignedProfessorIds: ["prf-juliana"]
  },
  {
    id: "stu-carla",
    enrollmentId: "mat-carla-2026-1",
    registration: "202300127",
    name: "Carla Menezes Rocha",
    email: "carla.rocha@ies.edu.br",
    cellphone: "(11) 99999-1027",
    course: "Fisioterapia",
    semesterId: currentSemester.id,
    classId: currentClass.id,
    assignedProfessorIds: ["prf-juliana"]
  }
];

export const professors: ProfessorRecord[] = [
  {
    id: "prf-juliana",
    name: "Dra. Juliana Martins",
    email: "juliana.martins@ies.edu.br",
    linkedEnrollmentIds: students.map((student) => student.enrollmentId)
  }
];

export const coordinators: CoordinatorRecord[] = [
  {
    id: "coord-marcelo",
    name: "Prof. Marcelo Carvalho",
    email: "marcelo.carvalho@ies.edu.br"
  }
];

export const evaluationLaunches: EvaluationLaunch[] = [
  {
    id: "eva-ana-1",
    enrollmentId: "mat-ana-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "1ª devolutiva",
    launchType: "parcial",
    publishedAt: "2026-02-20T14:00:00-03:00",
    notes: "Boa adaptação inicial ao estágio.",
    items: [
      { criterionId: "objetivos_terapeuticos", rawScore: 8.0 },
      { criterionId: "tecnicas_adequadas", rawScore: 8.4 },
      { criterionId: "justificativa_cientifica", rawScore: 7.8 },
      { criterionId: "iniciativa", rawScore: 9.0 },
      { criterionId: "manuseio_equipamentos", rawScore: 8.1 },
      { criterionId: "etica_bioetica", rawScore: 9.2 },
      { criterionId: "escrita_clinica", rawScore: 8.0 },
      { criterionId: "trabalhos_seminarios", rawScore: 8.4 }
    ]
  },
  {
    id: "eva-ana-2",
    enrollmentId: "mat-ana-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Meio do semestre",
    launchType: "revisao",
    publishedAt: "2026-03-28T14:30:00-03:00",
    notes: "Evolução consistente com boa participação em seminário.",
    items: [
      { criterionId: "objetivos_terapeuticos", rawScore: 8.6 },
      { criterionId: "tempo_avaliacao", rawScore: 8.2 },
      { criterionId: "diagnostico_cineticofuncional", rawScore: 8.0 },
      { criterionId: "trabalho_equipe", rawScore: 8.8 },
      { criterionId: "provas_teoricas", rawScore: 7.6 },
      { criterionId: "atividade_pratica", rawScore: 8.3 }
    ]
  },
  {
    id: "eva-ana-3",
    enrollmentId: "mat-ana-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Fechamento parcial",
    launchType: "fechamento",
    publishedAt: "2026-04-15T16:00:00-03:00",
    notes: "Entrega madura e estável.",
    items: [
      { criterionId: "esclarecimento_tratamento", rawScore: 8.7 },
      { criterionId: "compromisso_profissional", rawScore: 9.1 },
      { criterionId: "provas_teoricas", rawScore: 8.1 },
      { criterionId: "atividade_pratica", rawScore: 8.7 }
    ]
  },
  {
    id: "eva-bruno-1",
    enrollmentId: "mat-bruno-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "1ª devolutiva",
    launchType: "parcial",
    publishedAt: "2026-02-22T15:00:00-03:00",
    notes: "Precisa melhorar organização e tempo de avaliação.",
    items: [
      { criterionId: "objetivos_terapeuticos", rawScore: 6.2 },
      { criterionId: "tecnicas_adequadas", rawScore: 6.0 },
      { criterionId: "justificativa_cientifica", rawScore: 5.8 },
      { criterionId: "manuseio_equipamentos", rawScore: 6.5 },
      { criterionId: "etica_bioetica", rawScore: 8.0 },
      { criterionId: "escrita_clinica", rawScore: 6.4 }
    ]
  },
  {
    id: "eva-bruno-2",
    enrollmentId: "mat-bruno-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Meio do semestre",
    launchType: "revisao",
    publishedAt: "2026-03-29T14:00:00-03:00",
    notes: "Ainda oscila em prova teórica e prática.",
    items: [
      { criterionId: "tempo_avaliacao", rawScore: 5.5 },
      { criterionId: "diagnostico_cineticofuncional", rawScore: 6.1 },
      { criterionId: "trabalho_equipe", rawScore: 6.7 },
      { criterionId: "trabalhos_seminarios", rawScore: 7.2 },
      { criterionId: "provas_teoricas", rawScore: 5.9 },
      { criterionId: "atividade_pratica", rawScore: 6.3 }
    ]
  },
  {
    id: "eva-bruno-3",
    enrollmentId: "mat-bruno-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Fechamento parcial",
    launchType: "fechamento",
    publishedAt: "2026-04-16T10:00:00-03:00",
    notes: "Melhora leve, mas ainda requer atenção.",
    items: [
      { criterionId: "iniciativa", rawScore: 6.4 },
      { criterionId: "esclarecimento_tratamento", rawScore: 6.0 },
      { criterionId: "compromisso_profissional", rawScore: 7.0 },
      { criterionId: "provas_teoricas", rawScore: 6.2 }
    ]
  },
  {
    id: "eva-carla-1",
    enrollmentId: "mat-carla-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "1ª devolutiva",
    launchType: "parcial",
    publishedAt: "2026-02-24T13:00:00-03:00",
    notes: "Desempenho técnico acima da média.",
    items: [
      { criterionId: "objetivos_terapeuticos", rawScore: 9.0 },
      { criterionId: "tecnicas_adequadas", rawScore: 9.2 },
      { criterionId: "justificativa_cientifica", rawScore: 8.9 },
      { criterionId: "iniciativa", rawScore: 9.5 },
      { criterionId: "manuseio_equipamentos", rawScore: 9.1 },
      { criterionId: "etica_bioetica", rawScore: 9.7 },
      { criterionId: "escrita_clinica", rawScore: 8.8 },
      { criterionId: "trabalhos_seminarios", rawScore: 9.0 }
    ]
  },
  {
    id: "eva-carla-2",
    enrollmentId: "mat-carla-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Meio do semestre",
    launchType: "revisao",
    publishedAt: "2026-03-31T11:00:00-03:00",
    notes: "Mantém desempenho forte, com faltas impactando a média.",
    items: [
      { criterionId: "tempo_avaliacao", rawScore: 9.1 },
      { criterionId: "diagnostico_cineticofuncional", rawScore: 8.9 },
      { criterionId: "trabalho_equipe", rawScore: 9.0 },
      { criterionId: "provas_teoricas", rawScore: 8.8 },
      { criterionId: "atividade_pratica", rawScore: 9.4 }
    ]
  },
  {
    id: "eva-carla-3",
    enrollmentId: "mat-carla-2026-1",
    semesterId: currentSemester.id,
    professorId: "prf-juliana",
    reference: "Fechamento parcial",
    launchType: "fechamento",
    publishedAt: "2026-04-17T15:30:00-03:00",
    notes: "Indicadores técnicos excelentes.",
    items: [
      { criterionId: "esclarecimento_tratamento", rawScore: 9.2 },
      { criterionId: "compromisso_profissional", rawScore: 9.8 }
    ]
  }
];

export const absences: AbsenceRecord[] = [
  {
    id: "aus-ana-1",
    enrollmentId: "mat-ana-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-03-05",
    hours: 1,
    justified: false,
    reason: "Ausência em atendimento supervisionado"
  },
  {
    id: "aus-ana-2",
    enrollmentId: "mat-ana-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-04-02",
    hours: 2,
    justified: true,
    reason: "Atestado médico"
  },
  {
    id: "aus-bruno-1",
    enrollmentId: "mat-bruno-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-03-12",
    hours: 2,
    justified: false,
    reason: "Atraso e saída antecipada"
  },
  {
    id: "aus-bruno-2",
    enrollmentId: "mat-bruno-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-04-08",
    hours: 1,
    justified: false,
    reason: "Falta integral sem justificativa"
  },
  {
    id: "aus-carla-1",
    enrollmentId: "mat-carla-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-03-19",
    hours: 1,
    justified: false,
    reason: "Ausência parcial"
  },
  {
    id: "aus-carla-2",
    enrollmentId: "mat-carla-2026-1",
    registeredBy: "prf-juliana",
    date: "2026-04-12",
    hours: 1,
    justified: false,
    reason: "Ausência em prática clínica"
  }
];

export const auditEntries: AuditEntry[] = [
  {
    id: "aud-1",
    tableName: "avaliacoes",
    action: "INSERT",
    actorId: "prf-juliana",
    actorName: "Dra. Juliana Martins",
    happenedAt: "2026-04-17T15:30:00-03:00",
    recordLabel: "Fechamento parcial - Carla Menezes Rocha",
    summary: "Novo lançamento de fechamento parcial com atualização da comunicação e liderança."
  },
  {
    id: "aud-2",
    tableName: "ausencias",
    action: "INSERT",
    actorId: "prf-juliana",
    actorName: "Dra. Juliana Martins",
    happenedAt: "2026-04-12T09:15:00-03:00",
    recordLabel: "Ausência - Carla Menezes Rocha",
    summary: "Registro de 1 hora não justificada em prática clínica."
  },
  {
    id: "aud-3",
    tableName: "itens_avaliados",
    action: "UPDATE",
    actorId: "prf-juliana",
    actorName: "Dra. Juliana Martins",
    happenedAt: "2026-04-16T10:05:00-03:00",
    recordLabel: "Provas teóricas - Bruno Henrique Lima",
    summary: "Revisão da nota teórica após correção adicional."
  }
];
