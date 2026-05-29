"use client";

import { useEffect } from "react";

export function ClinicalPrintMode() {
  useEffect(() => {
    document.documentElement.classList.add("clinical-print-mode");
    document.body.classList.add("clinical-print-mode");

    return () => {
      document.documentElement.classList.remove("clinical-print-mode");
      document.body.classList.remove("clinical-print-mode");
    };
  }, []);

  return null;
}
