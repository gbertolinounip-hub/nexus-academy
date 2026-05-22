import { LoginForm } from "@/components/forms/login-form";
import { redirectIfAuthenticated } from "@/lib/auth/session";

function resolveNoticeMessage(authNotice?: string) {
  if (authNotice === "password-updated") {
    return "Senha redefinida com sucesso. Faça login com a nova senha.";
  }

  if (authNotice === "recovery-invalid") {
    return "O link de recuperação é inválido ou expirou. Solicite um novo e-mail.";
  }

  if (authNotice === "access-blocked") {
    return "Acesso bloqueado. Entre em contato com a coordenação.";
  }

  return null;
}

export default async function LoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectIfAuthenticated();
  const searchParams = (await props.searchParams) ?? {};
  const authNotice = Array.isArray(searchParams.auth_notice)
    ? searchParams.auth_notice[0]
    : searchParams.auth_notice;

  return (
    <div className="login-page">
      <LoginForm noticeMessage={resolveNoticeMessage(authNotice)} />
    </div>
  );
}



