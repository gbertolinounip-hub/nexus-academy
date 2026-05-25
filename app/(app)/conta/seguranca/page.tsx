import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function AccountSecurityPage() {
  const currentUser = await requireAuthenticatedUser();

  return (
    <div className="stack account-security-page">
      <section className="hero-card">
        <p className="eyebrow">Segurança da conta</p>
        <h1>Alteração de senha</h1>
        <p>
          {
            "Atualize sua senha institucional para manter seu acesso protegido. A nova senha passa a valer imediatamente para os pr\u00f3ximos acessos."
          }
        </p>
      </section>

      <SectionCard
        title="Credenciais de acesso"
        description={`Conta autenticada: ${currentUser.email}. Informe sua senha atual e defina uma nova senha com ao menos 8 caracteres.`}
        actions={
          <Link href={"/redirecionar" as Route} className="button button-secondary">
            {"Voltar para minha \u00e1rea"}
          </Link>
        }
        className="account-security-card"
      >
        <ChangePasswordForm email={currentUser.email} />
      </SectionCard>
    </div>
  );
}
