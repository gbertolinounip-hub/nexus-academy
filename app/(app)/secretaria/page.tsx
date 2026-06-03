import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";

export default async function SecretaryDashboardPage() {
  const currentUser = await requireRole(["secretaria"]);

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Secretaria</p>
        <h1>{currentUser.name}</h1>
        <p>
          Apoie a rotina administrativa da Clínica Supervisionada da unidade,
          com foco em cadastro de pacientes, atribuição operacional e consulta
          da base institucional.
        </p>
      </section>

      <SectionCard
        title="Rotina administrativa"
        description="Acesse os fluxos liberados para a secretaria no escopo da própria unidade."
      >
        <div className="actions-row">
          <Link href={"/clinica-supervisionada" as Route} className="button">
            Abrir Clínica Supervisionada
          </Link>
          <Link href={"/pacientes" as Route} className="button button-secondary">
            Abrir Pacientes
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
