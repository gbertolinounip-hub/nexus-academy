import Image from "next/image";

interface BrandLockupProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  prominent?: boolean;
}

export function BrandLockup({
  eyebrow,
  title = "Nexus Academy",
  subtitle,
  compact = false,
  prominent = false
}: BrandLockupProps) {
  const className = [
    "brand-lockup",
    compact ? "brand-lockup-compact" : null,
    prominent ? "brand-lockup-prominent" : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="brand-mark" aria-hidden="true">
        <Image
          src="/brand/nexus-simbolo.png"
          alt=""
          fill
          sizes={compact ? "44px" : prominent ? "76px" : "56px"}
          className="brand-mark-image"
        />
      </div>

      <div className="brand-lockup-copy">
        {eyebrow ? <p className="brand-lockup-eyebrow">{eyebrow}</p> : null}
        <strong className="brand-lockup-title">{title}</strong>
        {subtitle ? <span className="brand-lockup-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  );
}
