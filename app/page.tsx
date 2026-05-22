import Link from "next/link";
import { BrandLockup } from "@/components/common/brand-lockup";
import { MetricCard } from "@/components/common/metric-card";

export default function HomePage() {
  return (
    <div className="landing stack">
      <section className="hero-card">
        <BrandLockup
          eyebrow="Experiência institucional"
          subtitle="Ecossistema acadêmico com foco em clareza, rastreabilidade e gestão"
        />
        <h1>Gestão acadêmica, dashboards e relatórios em uma única plataforma</h1>
        <p>
          A Nexus Academy reúne acompanhamento operacional, leitura gerencial e
          histórico acadêmico em uma interface mais limpa, tecnológica e
          institucional.
        </p>

        <div className="landing-links">
          <Link href="/login" className="button">
            Abrir login
          </Link>
          <Link href="/aluno" className="button button-secondary">
            Ver dashboard do aluno
          </Link>
          <Link href="/professor" className="button button-secondary">
            Ver painel do professor
          </Link>
          <Link href="/coordenador" className="button button-secondary">
            Ver painel do coordenador
          </Link>
        </div>
      </section>

      <div className="highlight-grid">
        <MetricCard
          label="Segurança"
          value="RLS + DAL"
          hint="Defesa em profundidade no banco e na aplicação."
          tone="positive"
        />
        <MetricCard
          label="Cálculo"
          value="0..100"
          hint="Pesos percentuais claros e desconto por ausência."
        />
        <MetricCard
          label="Rastreabilidade"
          value="Versionada"
          hint="Cada lançamento permanece auditável ao longo do ciclo acadêmico."
        />
      </div>
    </div>
  );
}
