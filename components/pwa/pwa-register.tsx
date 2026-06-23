"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_URL,
          { scope: "/" }
        );

        await registration.update();

        const refreshRegistration = async () => {
          if (cancelled) {
            return;
          }

          await registration.update().catch(() => undefined);
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            void refreshRegistration();
          }
        };

        window.addEventListener("focus", refreshRegistration);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        cleanup = () => {
          window.removeEventListener("focus", refreshRegistration);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      } catch (error) {
        console.error("Falha ao registrar o service worker do Nexus Academy.", error);
      }
    };

    void registerServiceWorker();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
