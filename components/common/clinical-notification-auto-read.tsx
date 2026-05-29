"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markClinicalApprovalNotificationsAsReadForRecordAction } from "@/app/(app)/clinica-supervisionada/notifications-actions";
import type { ClinicalRecordType } from "@/types/domain";

interface ClinicalNotificationAutoReadProps {
  enabled: boolean;
  caseId: string;
  recordId: string;
  recordType: ClinicalRecordType;
}

export function ClinicalNotificationAutoRead({
  enabled,
  caseId,
  recordId,
  recordType
}: ClinicalNotificationAutoReadProps) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void markClinicalApprovalNotificationsAsReadForRecordAction({
      case_id: caseId,
      record_id: recordId,
      record_type: recordType
    }).then((didUpdate) => {
      if (didUpdate) {
        router.refresh();
      }
    });
  }, [caseId, enabled, recordId, recordType, router]);

  return null;
}
