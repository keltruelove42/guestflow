"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MAX_WIDTH = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
} as const;

/**
 * Centered modal shell: dimmed backdrop + card with a title bar and Close button.
 * Replaces the hand-rolled `fixed inset-0 … bg-black/40` copies across the app.
 */
export function Modal({
  title,
  onClose,
  children,
  size = "md",
  zIndex = 50,
  closeOnBackdrop = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof MAX_WIDTH;
  zIndex?: number;
  closeOnBackdrop?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
      style={{ zIndex }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl",
          MAX_WIDTH[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Right-hand slide-over used for record detail (e.g. the lead drawer).
 */
export function Drawer({
  onClose,
  children,
  widthClass = "max-w-lg",
  zIndex = 50,
}: {
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
  zIndex?: number;
}) {
  return (
    <div
      className="fixed inset-0 flex justify-end bg-black/30"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-y-auto border-l border-[var(--border)] bg-surface shadow-xl",
          widthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
