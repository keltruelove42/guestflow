/**
 * LeadCoda brand mark: the musical "coda" symbol (a circle crossed by two
 * strokes), the notation that brings a piece to its close. Story: LeadCoda
 * brings every lead to its close.
 */

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LeadCoda"
    >
      <defs>
        <linearGradient id="lc-g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0A1229" />
      <rect width="64" height="64" rx="15" fill="url(#lc-g)" fillOpacity="0.92" />
      <ellipse cx="32" cy="32" rx="10.5" ry="13" stroke="#fff" strokeWidth="5" />
      <path d="M32 9v46" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 32h40" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Wordmark: "Lead" in ink, "Coda" in brand blue. Pass light for dark bg. */
export function Wordmark({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className={light ? "text-white" : "text-ink"}>Lead</span>
      <span className={light ? "text-sky-300" : "text-[#2563eb]"}>Coda</span>
    </span>
  );
}

export function LogoLockup({
  size = 30,
  light = false,
  textClass = "text-lg",
}: {
  size?: number;
  light?: boolean;
  textClass?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <Wordmark light={light} className={textClass} />
    </span>
  );
}
