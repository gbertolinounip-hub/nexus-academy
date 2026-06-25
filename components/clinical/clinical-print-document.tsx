import Link from "next/link";
import type { Route } from "next";
import type { PropsWithChildren } from "react";
import { ClinicalPrintMode } from "@/components/clinical/clinical-print-mode";
import { ReportBrandLockup } from "@/components/reports/report-brand-lockup";
import { ReportAutoPrint } from "@/components/reports/report-auto-print";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import type { InstitutionalReportBranding } from "@/services/report-branding";

interface ClinicalPrintDocumentProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel?: string;
  autoPrint?: boolean;
  branding?: InstitutionalReportBranding | null;
}

export function ClinicalPrintDocument({
  title,
  subtitle,
  backHref,
  backLabel = "Voltar",
  autoPrint = false,
  branding,
  children
}: ClinicalPrintDocumentProps) {
  return (
    <div className="stack clinical-supervision-page clinical-print-page">
      <ClinicalPrintMode />
      <ReportAutoPrint enabled={autoPrint} />

      <section className="hero-card clinical-print-hero">
        <div className="clinical-print-masthead">
          <div className="clinical-print-brand">
            <ReportBrandLockup
              branding={branding}
              fallbackEyebrow="Clínica supervisionada"
              compact
            />
          </div>

          <div className="clinical-print-masthead-meta">
            <span>Documento clínico institucional</span>
            <strong>Versão preparada para impressão e arquivamento</strong>
          </div>
        </div>

        <div className="clinical-print-title-block">
          <p className="eyebrow">Prontuário clínico supervisionado</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="actions-row report-screen-only clinical-print-toolbar">
          <Link href={backHref as Route} className="button button-secondary">
            {backLabel}
          </Link>
          <ReportPrintButton />
        </div>
      </section>

      <div className="clinical-print-document-sections">{children}</div>

      <footer className="clinical-print-footer">
        <span>
          Nexus Academy · Clínica Supervisionada · Documento institucional para
          arquivamento
        </span>
      </footer>
    </div>
  );
}
