"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type State = "verifying" | "success" | "error";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("error");
      setMessage("This link is missing its verification code.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setState("success");
        } else {
          setState("error");
          setMessage(data.error ?? "This verification link is invalid.");
        }
      } catch {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      {state === "verifying" && (
        <p className="text-sm text-ink-2">Verifying your email…</p>
      )}
      {state === "success" && (
        <>
          <div className="mb-3 text-3xl">✅</div>
          <h1 className="text-lg font-semibold">Email verified</h1>
          <p className="mt-2 text-sm text-ink-2">
            Your account is confirmed and sending is now active.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <div className="mb-3 text-3xl">⚠️</div>
          <h1 className="text-lg font-semibold">Couldn't verify</h1>
          <p className="mt-2 text-sm text-ink-2">{message}</p>
          <Link
            href="/dashboard"
            className="mt-5 rounded-control border border-[var(--border)] px-4 py-2.5 text-sm font-medium"
          >
            Go to your account
          </Link>
          <p className="mt-2 text-xs text-muted">
            You can request a new link from the banner in your dashboard.
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
