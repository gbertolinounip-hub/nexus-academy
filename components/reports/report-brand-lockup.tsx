import { BrandLockup } from "@/components/common/brand-lockup";
import type { InstitutionalReportBranding } from "@/services/report-branding";

interface ReportBrandLockupProps {
  branding?: InstitutionalReportBranding | null;
  fallbackEyebrow: string;
  compact?: boolean;
}

export function ReportBrandLockup({
  branding,
  fallbackEyebrow,
  compact = false
}: ReportBrandLockupProps) {
  const showInstitutionLogo = Boolean(
    branding?.institutionLogoUrl && branding?.institutionDisplayName
  );

  return (
    <BrandLockup
      eyebrow={
        showInstitutionLogo && branding?.institutionDisplayName
          ? branding.institutionDisplayName
          : fallbackEyebrow
      }
      title={branding?.systemName ?? "Nexus Academy"}
      subtitle={
        branding?.systemSubtitle ?? "Gestão de estágios e desempenho acadêmico"
      }
      compact={compact}
      institutionLogoSrc={showInstitutionLogo ? branding?.institutionLogoUrl : null}
      institutionLogoAlt={
        showInstitutionLogo && branding?.institutionDisplayName
          ? `Logo de ${branding.institutionDisplayName}`
          : ""
      }
    />
  );
}
