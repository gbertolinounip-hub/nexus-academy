"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  isStudentAreaUnread,
  markStudentAreaAsRead,
  readStudentAreaUpdateState
} from "@/lib/student-area-updates";
import { formatPercentage, joinDisplayParts } from "@/lib/utils/format";

interface StudentOverviewAreaCardData {
  enrollmentId: string;
  areaName: string;
  blockName: string | null;
  className: string;
  professorNames: string[];
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  completionRate: number;
  publishedLaunchCount: number;
  unjustifiedAbsenceHours: number;
  recentUpdateAt: string | null;
}

interface StudentOverviewAreaCardsProps {
  currentUserId: string;
  areas: StudentOverviewAreaCardData[];
}

export function StudentOverviewAreaCards({
  currentUserId,
  areas
}: StudentOverviewAreaCardsProps) {
  const [areaReadState, setAreaReadState] = useState<Record<string, string>>({});

  useEffect(() => {
    setAreaReadState(readStudentAreaUpdateState(currentUserId));
  }, [currentUserId]);

  const unreadAreaIds = useMemo(() => {
    return new Set(
      areas
        .filter((area) =>
          isStudentAreaUnread(
            areaReadState[area.enrollmentId],
            area.recentUpdateAt
          )
        )
        .map((area) => area.enrollmentId)
    );
  }, [areaReadState, areas]);

  function handleAreaOpen(area: StudentOverviewAreaCardData) {
    if (!area.recentUpdateAt) {
      return;
    }

    const nextState = markStudentAreaAsRead({
      currentUserId,
      enrollmentId: area.enrollmentId,
      recentUpdateAt: area.recentUpdateAt
    });

    setAreaReadState(nextState);
  }

  return (
    <div className="student-overview-grid">
      {areas.map((area) => {
        const isUnreadUpdate = unreadAreaIds.has(area.enrollmentId);

        return (
          <article key={area.enrollmentId} className="student-overview-card">
            <div className="student-overview-card-header">
              <div>
                <h3>{area.areaName}</h3>
                <p>{joinDisplayParts([area.className])}</p>
              </div>
              <div className="student-overview-card-actions">
                <Link
                  href={`/aluno?matricula=${area.enrollmentId}`}
                  className="button button-secondary button-small"
                  onClick={() => handleAreaOpen(area)}
                >
                  Abrir area
                </Link>
                {isUnreadUpdate ? (
                  <span className="student-area-update-notice">
                    Avaliacao atualizada
                  </span>
                ) : null}
              </div>
            </div>

            <div className="student-overview-card-metrics">
              <span>Media: {formatPercentage(area.finalPercentage)}</span>
              <span>Subtotal: {formatPercentage(area.subtotalPercentage)}</span>
              <span>
                Desconto: {formatPercentage(area.absencePenaltyPercentage)}
              </span>
              <span>Conclusao: {formatPercentage(area.completionRate)}</span>
            </div>

            <p className="student-overview-card-copy">
              Supervisores:{" "}
              {area.professorNames.length
                ? area.professorNames.join(", ")
                : "ainda nao vinculados"}
            </p>
            <p className="student-overview-card-copy">
              Lancamentos publicados: {area.publishedLaunchCount} - Horas nao
              justificadas: {area.unjustifiedAbsenceHours.toFixed(2).replace(".", ",")}h
            </p>
          </article>
        );
      })}
    </div>
  );
}
