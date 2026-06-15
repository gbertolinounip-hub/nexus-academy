export interface Database {
  public: {
    Functions: {
      criar_avaliacao_com_itens: {
        Args: {
          p_matricula_turma_id: string;
          p_tipo_lancamento: "parcial" | "revisao" | "fechamento";
          p_referencia: string;
          p_observacoes: string | null;
          p_status: "rascunho" | "publicado";
          p_itens: Array<{
            criterio_id: string;
            nota_bruta: number;
            feedback?: string | null;
          }>;
          p_avaliado_em?: string;
        };
        Returns: string;
      };
      criar_revisao_avaliacao_com_itens: {
        Args: {
          p_avaliacao_origem_id: string;
          p_referencia: string;
          p_observacoes: string | null;
          p_status: "rascunho" | "publicado";
          p_itens: Array<{
            criterio_id: string;
            nota_bruta: number;
            feedback?: string | null;
          }>;
          p_avaliado_em?: string;
        };
        Returns: string;
      };
      atualizar_avaliacao_com_itens: {
        Args: {
          p_avaliacao_id: string;
          p_tipo_lancamento: "parcial" | "revisao" | "fechamento";
          p_referencia: string;
          p_observacoes: string | null;
          p_status: "rascunho" | "publicado";
          p_itens: Array<{
            criterio_id: string;
            nota_bruta: number;
            feedback?: string | null;
          }>;
          p_avaliado_em?: string;
        };
        Returns: string;
      };
      criar_ausencia: {
        Args: {
          p_matricula_turma_id: string;
          p_data_ausencia: string;
          p_horas: number;
          p_justificada: boolean;
          p_motivo?: string | null;
          p_observacoes?: string | null;
        };
        Returns: string;
      };
      atualizar_ausencia: {
        Args: {
          p_ausencia_id: string;
          p_data_ausencia: string;
          p_horas: number;
          p_justificada: boolean;
          p_motivo?: string | null;
          p_observacoes?: string | null;
        };
        Returns: string;
      };
      registrar_acesso_sistema: {
        Args: Record<string, never>;
        Returns: string;
      };
      obter_liberacao_excepcional_ativa: {
        Args: {
          p_tipo: "avaliacao" | "ausencia" | "clinica_supervisionada";
          p_semestre_id: string;
          p_turma_id?: string | null;
          p_aluno_id?: string | null;
          p_usuario_id?: string | null;
          p_unidade_id?: string | null;
          p_referencia_em?: string | null;
        };
        Returns: string | null;
      };
      tem_liberacao_excepcional_ativa: {
        Args: {
          p_tipo: "avaliacao" | "ausencia" | "clinica_supervisionada";
          p_semestre_id: string;
          p_turma_id?: string | null;
          p_aluno_id?: string | null;
          p_usuario_id?: string | null;
          p_unidade_id?: string | null;
          p_referencia_em?: string | null;
        };
        Returns: boolean;
      };
      vincular_liberacao_excepcional_auditoria: {
        Args: {
          p_liberacao_excepcional_id: string;
          p_tabela: string;
          p_registro_ids: string[];
        };
        Returns: number;
      };
    };
    Tables: {
      perfis: {
        Row: {
          id: number;
          codigo:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso";
          nome: string;
          descricao: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          codigo:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso";
          nome: string;
          descricao?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          codigo?:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso";
          nome?: string;
          descricao?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      instituicoes: {
        Row: {
          id: string;
          nome: string;
          sigla: string | null;
          slug: string;
          cnpj: string | null;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          sigla?: string | null;
          slug: string;
          cnpj?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          sigla?: string | null;
          slug?: string;
          cnpj?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cursos: {
        Row: {
          id: string;
          instituicao_id: string;
          codigo: string;
          nome: string;
          slug: string;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instituicao_id: string;
          codigo: string;
          nome: string;
          slug: string;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instituicao_id?: string;
          codigo?: string;
          nome?: string;
          slug?: string;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ofertas_curso_unidade: {
        Row: {
          id: string;
          instituicao_id: string;
          unidade_id: string;
          curso_id: string;
          codigo: string | null;
          nome_exibicao: string | null;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instituicao_id: string;
          unidade_id: string;
          curso_id: string;
          codigo?: string | null;
          nome_exibicao?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instituicao_id?: string;
          unidade_id?: string;
          curso_id?: string;
          codigo?: string | null;
          nome_exibicao?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios_papeis_contexto: {
        Row: {
          id: string;
          usuario_id: string;
          perfil_id: number;
          instituicao_id: string | null;
          curso_id: string | null;
          oferta_curso_unidade_id: string | null;
          principal: boolean;
          ativo: boolean;
          inicio_em: string | null;
          fim_em: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          perfil_id: number;
          instituicao_id?: string | null;
          curso_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          principal?: boolean;
          ativo?: boolean;
          inicio_em?: string | null;
          fim_em?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          perfil_id?: number;
          instituicao_id?: string | null;
          curso_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          principal?: boolean;
          ativo?: boolean;
          inicio_em?: string | null;
          fim_em?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      modelos_avaliacao_curso: {
        Row: {
          id: string;
          curso_id: string;
          codigo: string;
          nome: string;
          descricao: string | null;
          versao: number;
          modalidade: "descritiva" | "rubrica";
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          curso_id: string;
          codigo: string;
          nome: string;
          descricao?: string | null;
          versao?: number;
          modalidade?: "descritiva" | "rubrica";
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          curso_id?: string;
          codigo?: string;
          nome?: string;
          descricao?: string | null;
          versao?: number;
          modalidade?: "descritiva" | "rubrica";
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      grupos_modelo_avaliacao: {
        Row: {
          id: string;
          modelo_avaliacao_curso_id: string;
          codigo: string;
          nome: string;
          ordem: number;
          peso_percentual: number;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          modelo_avaliacao_curso_id: string;
          codigo: string;
          nome: string;
          ordem: number;
          peso_percentual: number;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          modelo_avaliacao_curso_id?: string;
          codigo?: string;
          nome?: string;
          ordem?: number;
          peso_percentual?: number;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      criterios_modelo_avaliacao: {
        Row: {
          id: string;
          grupo_modelo_avaliacao_id: string;
          codigo: string;
          nome: string;
          descricao: string | null;
          ordem: number;
          peso_percentual: number;
          escala_maxima: number;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          grupo_modelo_avaliacao_id: string;
          codigo: string;
          nome: string;
          descricao?: string | null;
          ordem: number;
          peso_percentual: number;
          escala_maxima?: number;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          grupo_modelo_avaliacao_id?: string;
          codigo?: string;
          nome?: string;
          descricao?: string | null;
          ordem?: number;
          peso_percentual?: number;
          escala_maxima?: number;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      opcoes_criterio_modelo_avaliacao: {
        Row: {
          id: string;
          criterio_modelo_avaliacao_id: string;
          rotulo: string;
          descricao: string | null;
          valor_nota: number;
          ordem: number;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          criterio_modelo_avaliacao_id: string;
          rotulo: string;
          descricao?: string | null;
          valor_nota: number;
          ordem?: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          criterio_modelo_avaliacao_id?: string;
          rotulo?: string;
          descricao?: string | null;
          valor_nota?: number;
          ordem?: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tipos_documento: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          descricao: string | null;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nome: string;
          descricao?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nome?: string;
          descricao?: string | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documentos_obrigatorios_curso: {
        Row: {
          id: string;
          curso_id: string;
          tipo_documento_id: string;
          codigo: string | null;
          nome_exibicao: string | null;
          descricao: string | null;
          obrigatorio: boolean;
          ordem: number | null;
          ativo: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          curso_id: string;
          tipo_documento_id: string;
          codigo?: string | null;
          nome_exibicao?: string | null;
          descricao?: string | null;
          obrigatorio?: boolean;
          ordem?: number | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          curso_id?: string;
          tipo_documento_id?: string;
          codigo?: string | null;
          nome_exibicao?: string | null;
          descricao?: string | null;
          obrigatorio?: boolean;
          ordem?: number | null;
          ativo?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      unidades: {
        Row: {
          id: string;
          instituicao_id: string | null;
          nome: string;
          sigla: string;
          slug: string;
          cidade: string | null;
          estado: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instituicao_id?: string | null;
          nome: string;
          sigla: string;
          slug: string;
          cidade?: string | null;
          estado?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instituicao_id?: string | null;
          nome?: string;
          sigla?: string;
          slug?: string;
          cidade?: string | null;
          estado?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          perfil_id: number;
          unidade_id: string | null;
          contexto_padrao_id: string | null;
          email: string;
          nome_completo: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          perfil_id: number;
          unidade_id?: string | null;
          contexto_padrao_id?: string | null;
          email: string;
          nome_completo: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          perfil_id?: number;
          unidade_id?: string | null;
          contexto_padrao_id?: string | null;
          email?: string;
          nome_completo?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alunos: {
        Row: {
          usuario_id: string;
          unidade_id: string | null;
          matricula: string;
          curso: string;
          curso_id: string | null;
          oferta_curso_unidade_id: string | null;
          celular: string | null;
          nome_social: string | null;
          data_ingresso: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          unidade_id?: string | null;
          matricula: string;
          curso?: string;
          curso_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          celular?: string | null;
          nome_social?: string | null;
          data_ingresso?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          unidade_id?: string | null;
          matricula?: string;
          curso?: string;
          curso_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          celular?: string | null;
          nome_social?: string | null;
          data_ingresso?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professores: {
        Row: {
          usuario_id: string;
          unidade_id: string | null;
          registro_funcional: string | null;
          departamento: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          unidade_id?: string | null;
          registro_funcional?: string | null;
          departamento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          unidade_id?: string | null;
          registro_funcional?: string | null;
          departamento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coordenadores: {
        Row: {
          usuario_id: string;
          unidade_id: string | null;
          cargo: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          unidade_id?: string | null;
          cargo: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          unidade_id?: string | null;
          cargo?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coordenadores_master: {
        Row: {
          usuario_id: string;
          cargo: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          cargo?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          cargo?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      semestres: {
        Row: {
          id: string;
          unidade_id: string | null;
          oferta_curso_unidade_id: string | null;
          codigo: string;
          nome: string;
          data_inicio: string;
          data_fim: string;
          status: "planejado" | "ativo" | "encerrado";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          codigo: string;
          nome: string;
          data_inicio: string;
          data_fim: string;
          status?: "planejado" | "ativo" | "encerrado";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          codigo?: string;
          nome?: string;
          data_inicio?: string;
          data_fim?: string;
          status?: "planejado" | "ativo" | "encerrado";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blocos_estagio: {
        Row: {
          id: number;
          codigo: "bloco_1" | "bloco_2";
          nome: string;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          codigo: "bloco_1" | "bloco_2";
          nome: string;
          ordem: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          codigo?: "bloco_1" | "bloco_2";
          nome?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      areas_estagio: {
        Row: {
          id: string;
          bloco_id: number;
          oferta_curso_unidade_id: string | null;
          codigo: string;
          nome: string;
          ordem: number;
          ativa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bloco_id: number;
          oferta_curso_unidade_id?: string | null;
          codigo: string;
          nome: string;
          ordem: number;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bloco_id?: number;
          oferta_curso_unidade_id?: string | null;
          codigo?: string;
          nome?: string;
          ordem?: number;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      turmas: {
        Row: {
          id: string;
          semestre_id: string;
          oferta_curso_unidade_id: string | null;
          codigo: string;
          nome: string;
          area_estagio: string;
          area_estagio_id: string | null;
          coordenador_id: string | null;
          capacidade: number | null;
          ativa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          semestre_id: string;
          oferta_curso_unidade_id?: string | null;
          codigo: string;
          nome: string;
          area_estagio: string;
          area_estagio_id?: string | null;
          coordenador_id?: string | null;
          capacidade?: number | null;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          semestre_id?: string;
          oferta_curso_unidade_id?: string | null;
          codigo?: string;
          nome?: string;
          area_estagio?: string;
          area_estagio_id?: string | null;
          coordenador_id?: string | null;
          capacidade?: number | null;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      matriculas_turma: {
        Row: {
          id: string;
          turma_id: string;
          aluno_id: string;
          oferta_curso_unidade_id: string | null;
          numero_chamada: number | null;
          status: "ativa" | "trancada" | "cancelada" | "concluida";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          turma_id: string;
          aluno_id: string;
          oferta_curso_unidade_id?: string | null;
          numero_chamada?: number | null;
          status?: "ativa" | "trancada" | "cancelada" | "concluida";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          turma_id?: string;
          aluno_id?: string;
          oferta_curso_unidade_id?: string | null;
          numero_chamada?: number | null;
          status?: "ativa" | "trancada" | "cancelada" | "concluida";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professor_areas_estagio: {
        Row: {
          id: string;
          professor_id: string;
          area_estagio_id: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professor_id: string;
          area_estagio_id: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          professor_id?: string;
          area_estagio_id?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vinculos_professor_aluno: {
        Row: {
          id: string;
          professor_id: string;
          matricula_turma_id: string;
          responsavel_principal: boolean;
          ativo: boolean;
          data_inicio: string;
          data_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professor_id: string;
          matricula_turma_id: string;
          responsavel_principal?: boolean;
          ativo?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          professor_id?: string;
          matricula_turma_id?: string;
          responsavel_principal?: boolean;
          ativo?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      grupos_avaliacao: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          ordem: number;
          peso_percentual: number;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nome: string;
          ordem: number;
          peso_percentual: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nome?: string;
          ordem?: number;
          peso_percentual?: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      criterios_avaliacao: {
        Row: {
          id: string;
          grupo_id: string;
          codigo: string;
          nome: string;
          descricao: string | null;
          ordem: number;
          peso_percentual: number;
          escala_maxima: number;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          codigo: string;
          nome: string;
          descricao?: string | null;
          ordem: number;
          peso_percentual: number;
          escala_maxima?: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          grupo_id?: string;
          codigo?: string;
          nome?: string;
          descricao?: string | null;
          ordem?: number;
          peso_percentual?: number;
          escala_maxima?: number;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      avaliacoes: {
        Row: {
          id: string;
          matricula_turma_id: string;
          professor_id: string;
          semestre_id: string;
          oferta_curso_unidade_id: string | null;
          modelo_avaliacao_curso_id: string | null;
          tipo_lancamento: "parcial" | "revisao" | "fechamento";
          referencia: string;
          observacoes: string | null;
          avaliacao_origem_id: string | null;
          avaliacao_raiz_id: string | null;
          status: "rascunho" | "publicado" | "cancelado";
          modalidade_snapshot: "descritiva" | "rubrica" | null;
          avaliado_em: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          matricula_turma_id: string;
          professor_id: string;
          semestre_id: string;
          oferta_curso_unidade_id?: string | null;
          modelo_avaliacao_curso_id?: string | null;
          tipo_lancamento: "parcial" | "revisao" | "fechamento";
          referencia: string;
          observacoes?: string | null;
          avaliacao_origem_id?: string | null;
          avaliacao_raiz_id?: string | null;
          status?: "rascunho" | "publicado" | "cancelado";
          modalidade_snapshot?: "descritiva" | "rubrica" | null;
          avaliado_em?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          matricula_turma_id?: string;
          professor_id?: string;
          semestre_id?: string;
          oferta_curso_unidade_id?: string | null;
          modelo_avaliacao_curso_id?: string | null;
          tipo_lancamento?: "parcial" | "revisao" | "fechamento";
          referencia?: string;
          observacoes?: string | null;
          avaliacao_origem_id?: string | null;
          avaliacao_raiz_id?: string | null;
          status?: "rascunho" | "publicado" | "cancelado";
          modalidade_snapshot?: "descritiva" | "rubrica" | null;
          avaliado_em?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      itens_avaliados: {
        Row: {
          id: string;
          avaliacao_id: string;
          criterio_id: string;
          criterio_modelo_avaliacao_id: string | null;
          opcao_criterio_modelo_avaliacao_id: string | null;
          nota_bruta: number;
          peso_aplicado_percentual: number;
          nota_ponderada_percentual: number;
          feedback: string | null;
          opcao_rotulo_snapshot: string | null;
          opcao_descricao_snapshot: string | null;
          opcao_valor_snapshot: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          avaliacao_id: string;
          criterio_id: string;
          criterio_modelo_avaliacao_id?: string | null;
          opcao_criterio_modelo_avaliacao_id?: string | null;
          nota_bruta: number;
          peso_aplicado_percentual: number;
          nota_ponderada_percentual?: number;
          feedback?: string | null;
          opcao_rotulo_snapshot?: string | null;
          opcao_descricao_snapshot?: string | null;
          opcao_valor_snapshot?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          avaliacao_id?: string;
          criterio_id?: string;
          criterio_modelo_avaliacao_id?: string | null;
          opcao_criterio_modelo_avaliacao_id?: string | null;
          nota_bruta?: number;
          peso_aplicado_percentual?: number;
          nota_ponderada_percentual?: number;
          feedback?: string | null;
          opcao_rotulo_snapshot?: string | null;
          opcao_descricao_snapshot?: string | null;
          opcao_valor_snapshot?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ausencias: {
        Row: {
          id: string;
          matricula_turma_id: string;
          registrado_por: string;
          oferta_curso_unidade_id: string | null;
          data_ausencia: string;
          horas: number;
          justificada: boolean;
          motivo: string | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          matricula_turma_id: string;
          registrado_por: string;
          oferta_curso_unidade_id?: string | null;
          data_ausencia: string;
          horas: number;
          justificada?: boolean;
          motivo?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          matricula_turma_id?: string;
          registrado_por?: string;
          oferta_curso_unidade_id?: string | null;
          data_ausencia?: string;
          horas?: number;
          justificada?: boolean;
          motivo?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pacientes_clinica: {
        Row: {
          id: string;
          unidade_id: string | null;
          identificador: string;
          nome: string;
          data_nascimento: string | null;
          cpf: string | null;
          contato: string | null;
          acompanhante: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          identificador: string;
          nome: string;
          data_nascimento?: string | null;
          cpf?: string | null;
          contato?: string | null;
          acompanhante?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          identificador?: string;
          nome?: string;
          data_nascimento?: string | null;
          cpf?: string | null;
          contato?: string | null;
          acompanhante?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      casos_clinicos: {
        Row: {
          id: string;
          unidade_id: string | null;
          paciente_id: string;
          matricula_turma_id: string;
          professor_id: string;
          semestre_id: string;
          turma_id: string;
          area_estagio_id: string | null;
          dia_semana:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento: string;
          status: "atribuido" | "ativo" | "encerrado" | "alta";
          ativo: boolean;
          data_inicio: string;
          data_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          paciente_id: string;
          matricula_turma_id: string;
          professor_id: string;
          semestre_id: string;
          turma_id: string;
          area_estagio_id?: string | null;
          dia_semana:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento: string;
          status?: "atribuido" | "ativo" | "encerrado" | "alta";
          ativo?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          paciente_id?: string;
          matricula_turma_id?: string;
          professor_id?: string;
          semestre_id?: string;
          turma_id?: string;
          area_estagio_id?: string | null;
          dia_semana?:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento?: string;
          status?: "atribuido" | "ativo" | "encerrado" | "alta";
          ativo?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      casos_clinicos_horarios: {
        Row: {
          id: string;
          caso_clinico_id: string;
          dia_semana:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_clinico_id: string;
          dia_semana:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_clinico_id?: string;
          dia_semana?:
            | "segunda"
            | "terca"
            | "quarta"
            | "quinta"
            | "sexta"
            | "sabado";
          horario_atendimento?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registros_clinicos: {
        Row: {
          id: string;
          unidade_id: string | null;
          caso_clinico_id: string;
          tipo: "avaliacao" | "plano_tratamento" | "evolucao";
          status: "rascunho" | "enviado" | "aprovado" | "ajustes_solicitados";
          conteudo_json: Record<string, unknown>;
          parecer_supervisor: string | null;
          autor_id: string;
          revisado_por: string | null;
          enviado_em: string | null;
          revisado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          caso_clinico_id: string;
          tipo: "avaliacao" | "plano_tratamento" | "evolucao";
          status?: "rascunho" | "enviado" | "aprovado" | "ajustes_solicitados";
          conteudo_json?: Record<string, unknown>;
          parecer_supervisor?: string | null;
          autor_id: string;
          revisado_por?: string | null;
          enviado_em?: string | null;
          revisado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          caso_clinico_id?: string;
          tipo?: "avaliacao" | "plano_tratamento" | "evolucao";
          status?: "rascunho" | "enviado" | "aprovado" | "ajustes_solicitados";
          conteudo_json?: Record<string, unknown>;
          parecer_supervisor?: string | null;
          autor_id?: string;
          revisado_por?: string | null;
          enviado_em?: string | null;
          revisado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notificacoes_clinicas: {
        Row: {
          id: string;
          unidade_id: string | null;
          usuario_id: string;
          caso_clinico_id: string;
          registro_clinico_id: string | null;
          tipo:
            | "avaliacao_enviada_supervisao"
            | "avaliacao_ajustes_solicitados"
            | "avaliacao_aprovada"
            | "plano_tratamento_enviado_supervisao"
            | "plano_tratamento_ajustes_solicitados"
            | "plano_tratamento_aprovado"
            | "evolucao_enviada_supervisao"
            | "evolucao_ajustes_solicitados"
            | "evolucao_aprovada";
          titulo: string;
          mensagem: string;
          lida: boolean;
          lida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          usuario_id: string;
          caso_clinico_id: string;
          registro_clinico_id?: string | null;
          tipo:
            | "avaliacao_enviada_supervisao"
            | "avaliacao_ajustes_solicitados"
            | "avaliacao_aprovada"
            | "plano_tratamento_enviado_supervisao"
            | "plano_tratamento_ajustes_solicitados"
            | "plano_tratamento_aprovado"
            | "evolucao_enviada_supervisao"
            | "evolucao_ajustes_solicitados"
            | "evolucao_aprovada";
          titulo: string;
          mensagem: string;
          lida?: boolean;
          lida_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          usuario_id?: string;
          caso_clinico_id?: string;
          registro_clinico_id?: string | null;
          tipo?:
            | "avaliacao_enviada_supervisao"
            | "avaliacao_ajustes_solicitados"
            | "avaliacao_aprovada"
            | "plano_tratamento_enviado_supervisao"
            | "plano_tratamento_ajustes_solicitados"
            | "plano_tratamento_aprovado"
            | "evolucao_enviada_supervisao"
            | "evolucao_ajustes_solicitados"
            | "evolucao_aprovada";
          titulo?: string;
          mensagem?: string;
          lida?: boolean;
          lida_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documentos_aluno: {
        Row: {
          id: string;
          unidade_id: string | null;
          aluno_id: string;
          matricula_turma_id: string | null;
          oferta_curso_unidade_id: string | null;
          documento_obrigatorio_curso_id: string | null;
          area_estagio_id: string | null;
          tipo: "carteira_vacinacao" | "tce";
          status: "enviado" | "aprovado" | "reprovado";
          arquivo_nome: string;
          arquivo_mime_type: string;
          arquivo_tamanho_bytes: number;
          storage_path: string;
          observacao_validacao: string | null;
          ativo: boolean;
          versao: number;
          documento_anterior_id: string | null;
          validado_por: string | null;
          validado_por_papel: "professor" | "coordenador" | null;
          enviado_em: string;
          validado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          aluno_id: string;
          matricula_turma_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          documento_obrigatorio_curso_id?: string | null;
          area_estagio_id?: string | null;
          tipo: "carteira_vacinacao" | "tce";
          status?: "enviado" | "aprovado" | "reprovado";
          arquivo_nome: string;
          arquivo_mime_type: string;
          arquivo_tamanho_bytes: number;
          storage_path: string;
          observacao_validacao?: string | null;
          ativo?: boolean;
          versao?: number;
          documento_anterior_id?: string | null;
          validado_por?: string | null;
          validado_por_papel?: "professor" | "coordenador" | null;
          enviado_em?: string;
          validado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          aluno_id?: string;
          matricula_turma_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          documento_obrigatorio_curso_id?: string | null;
          area_estagio_id?: string | null;
          tipo?: "carteira_vacinacao" | "tce";
          status?: "enviado" | "aprovado" | "reprovado";
          arquivo_nome?: string;
          arquivo_mime_type?: string;
          arquivo_tamanho_bytes?: number;
          storage_path?: string;
          observacao_validacao?: string | null;
          ativo?: boolean;
          versao?: number;
          documento_anterior_id?: string | null;
          validado_por?: string | null;
          validado_por_papel?: "professor" | "coordenador" | null;
          enviado_em?: string;
          validado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notificacoes_documentos_aluno: {
        Row: {
          id: string;
          unidade_id: string | null;
          usuario_id: string;
          documento_id: string;
          tipo:
            | "documento_reprovado_professor"
            | "documento_reprovado_coordenador";
          titulo: string;
          mensagem: string;
          lida: boolean;
          lida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id?: string | null;
          usuario_id: string;
          documento_id: string;
          tipo:
            | "documento_reprovado_professor"
            | "documento_reprovado_coordenador";
          titulo: string;
          mensagem: string;
          lida?: boolean;
          lida_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string | null;
          usuario_id?: string;
          documento_id?: string;
          tipo?:
            | "documento_reprovado_professor"
            | "documento_reprovado_coordenador";
          titulo?: string;
          mensagem?: string;
          lida?: boolean;
          lida_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      acessos_sistema: {
        Row: {
          id: string;
          usuario_id: string;
          unidade_id: string | null;
          nome_usuario: string;
          email: string | null;
          perfil:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso"
            | null;
          acessado_em: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          unidade_id?: string | null;
          nome_usuario: string;
          email?: string | null;
          perfil?:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso"
            | null;
          acessado_em?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          unidade_id?: string | null;
          nome_usuario?: string;
          email?: string | null;
          perfil?:
            | "aluno"
            | "professor"
            | "secretaria"
            | "coordenador"
            | "coordenador_master"
            | "master_curso"
            | null;
          acessado_em?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      liberacoes_excepcionais: {
        Row: {
          id: string;
          unidade_id: string;
          semestre_id: string;
          turma_id: string | null;
          aluno_id: string | null;
          oferta_curso_unidade_id: string | null;
          usuario_autorizado_id: string;
          tipo: "avaliacao" | "ausencia" | "clinica_supervisionada";
          escopo: "semestre" | "turma" | "aluno";
          motivo: string;
          criado_por: string;
          inicio_em: string;
          expira_em: string;
          ativo: boolean;
          encerrado_manualmente_em: string | null;
          utilizado_em: string | null;
          utilizado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unidade_id: string;
          semestre_id: string;
          turma_id?: string | null;
          aluno_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          usuario_autorizado_id: string;
          tipo: "avaliacao" | "ausencia" | "clinica_supervisionada";
          escopo: "semestre" | "turma" | "aluno";
          motivo: string;
          criado_por: string;
          inicio_em?: string;
          expira_em: string;
          ativo?: boolean;
          encerrado_manualmente_em?: string | null;
          utilizado_em?: string | null;
          utilizado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unidade_id?: string;
          semestre_id?: string;
          turma_id?: string | null;
          aluno_id?: string | null;
          oferta_curso_unidade_id?: string | null;
          usuario_autorizado_id?: string;
          tipo?: "avaliacao" | "ausencia" | "clinica_supervisionada";
          escopo?: "semestre" | "turma" | "aluno";
          motivo?: string;
          criado_por?: string;
          inicio_em?: string;
          expira_em?: string;
          ativo?: boolean;
          encerrado_manualmente_em?: string | null;
          utilizado_em?: string | null;
          utilizado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      historico_alteracoes: {
        Row: {
          id: number;
          tabela: string;
          registro_id: string | null;
          acao: "INSERT" | "UPDATE" | "DELETE";
          dados_antes: Record<string, unknown> | null;
          dados_depois: Record<string, unknown> | null;
          usuario_id: string | null;
          unidade_id: string | null;
          liberacao_excepcional_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          tabela: string;
          registro_id?: string | null;
          acao: "INSERT" | "UPDATE" | "DELETE";
          dados_antes?: Record<string, unknown> | null;
          dados_depois?: Record<string, unknown> | null;
          usuario_id?: string | null;
          unidade_id?: string | null;
          liberacao_excepcional_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          tabela?: string;
          registro_id?: string | null;
          acao?: "INSERT" | "UPDATE" | "DELETE";
          dados_antes?: Record<string, unknown> | null;
          dados_depois?: Record<string, unknown> | null;
          usuario_id?: string | null;
          unidade_id?: string | null;
          liberacao_excepcional_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
  };
}
