const STUDENT_UPDATE_STORAGE_PREFIX = "nexus-student-area-updates";

function buildStudentUpdateStorageKey(currentUserId: string) {
  return `${STUDENT_UPDATE_STORAGE_PREFIX}:${currentUserId}`;
}

export function readStudentAreaUpdateState(currentUserId: string) {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const rawValue = window.localStorage.getItem(
      buildStudentUpdateStorageKey(currentUserId)
    );

    if (!rawValue) {
      return {} as Record<string, string>;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        ([key, value]) => typeof key === "string" && typeof value === "string"
      )
    ) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

export function writeStudentAreaUpdateState(
  currentUserId: string,
  state: Record<string, string>
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    buildStudentUpdateStorageKey(currentUserId),
    JSON.stringify(state)
  );
}

export function isStudentAreaUnread(
  lastReadAt: string | null | undefined,
  recentUpdateAt: string | null | undefined
) {
  if (!recentUpdateAt) {
    return false;
  }

  if (!lastReadAt) {
    return true;
  }

  return lastReadAt < recentUpdateAt;
}

export function markStudentAreaAsRead(input: {
  currentUserId: string;
  enrollmentId: string;
  recentUpdateAt: string;
}) {
  const currentState = readStudentAreaUpdateState(input.currentUserId);

  if (currentState[input.enrollmentId] === input.recentUpdateAt) {
    return currentState;
  }

  const nextState: Record<string, string> = {
    ...currentState,
    [input.enrollmentId]: input.recentUpdateAt
  };
  writeStudentAreaUpdateState(input.currentUserId, nextState);
  return nextState;
}
