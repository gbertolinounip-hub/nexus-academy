"use client";

import { useEffect } from "react";

interface ReportAutoPrintProps {
  enabled: boolean;
}

export function ReportAutoPrint({ enabled }: ReportAutoPrintProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => window.clearTimeout(handle);
  }, [enabled]);

  return null;
}
