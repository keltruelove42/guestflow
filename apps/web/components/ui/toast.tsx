"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Auto-dismissing toast, replacing the `setToast` + `setTimeout` + fixed-position
 * markup reimplemented across campaigns, leads, calendar and the app shell.
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   …
 *   showToast("Saved");
 *   …
 *   <Toast message={toast} />
 */
export function useToast(durationMs = 4000) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-card border border-[var(--border)] bg-surface px-4 py-2.5 text-sm shadow-lg md:bottom-6">
      {message}
    </div>
  );
}
