"use client";

interface ReportPrintButtonProps {
  label?: string;
}

export function ReportPrintButton({
  label = "Imprimir / PDF"
}: ReportPrintButtonProps) {
  return (
    <button
      type="button"
      className="button button-secondary report-screen-only"
      onClick={() => {
        window.print();
      }}
    >
      {label}
    </button>
  );
}
