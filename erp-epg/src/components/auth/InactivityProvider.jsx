"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIMEOUT_MS = 25 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function InactivityProvider({ children }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(null);
  const lastActivityRef = useRef(null);
  const hasSessionRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    async function doLogout() {
      await supabase.auth.signOut();
      router.push("/login");
    }

    function resetActivity() {
      lastActivityRef.current = Date.now();
      setSecondsLeft(null);
    }

    function attachActivityListeners() {
      ACTIVITY_EVENTS.forEach((event) =>
        window.addEventListener(event, resetActivity, {
          capture: true,
          passive: true,
        })
      );
    }

    function detachActivityListeners() {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetActivity, { capture: true })
      );
    }

    const checkInterval = setInterval(() => {
      if (!hasSessionRef.current) return;

      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= TIMEOUT_MS) {
        doLogout();
      } else if (elapsed >= TIMEOUT_MS - WARNING_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((TIMEOUT_MS - elapsed) / 1000)));
      } else {
        setSecondsLeft(null);
      }
    }, CHECK_INTERVAL_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const hadSession = hasSessionRef.current;
      hasSessionRef.current = Boolean(session);

      if (session && !hadSession) {
        resetActivity();
        attachActivityListeners();
      } else if (!session && hadSession) {
        detachActivityListeners();
        setSecondsLeft(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      hasSessionRef.current = Boolean(session);
      if (session) {
        resetActivity();
        attachActivityListeners();
      }
    });

    return () => {
      clearInterval(checkInterval);
      detachActivityListeners();
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) return;

    const tick = setInterval(() => {
      setSecondsLeft((current) =>
        current === null ? null : Math.max(0, current - 1)
      );
    }, 1000);

    return () => clearInterval(tick);
  }, [secondsLeft]);

  function handleStaySignedIn() {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  }

  return (
    <>
      {children}
      {secondsLeft !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="palacio-card flex w-full max-w-sm flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">Tu sesión está por expirar</h2>
            <p className="text-sm">
              Por inactividad, tu sesión se cerrará en{" "}
              <span className="font-semibold">{secondsLeft}</span> segundos.
            </p>
            <button
              type="button"
              onClick={handleStaySignedIn}
              className="palacio-btn-primary px-3 py-2 text-sm"
            >
              Seguir conectado
            </button>
          </div>
        </div>
      )}
    </>
  );
}
