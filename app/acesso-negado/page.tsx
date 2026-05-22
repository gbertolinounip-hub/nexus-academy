import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-copy">
          <p className="eyebrow">Acesso negado</p>
          <h1>Seu usuário não pode acessar este recurso</h1>
          <p>
            Verifique se o usuário possui perfil acadêmico ativo em `usuários` e
            vínculo correto em `perfis`.
          </p>
        </div>

        <div className="actions-row">
          <Link href="/login" className="button">
            Voltar ao login
          </Link>
          <Link href="/" className="button button-secondary">
            Ir para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}



