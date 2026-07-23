"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT = {
  primary: "bg-accent font-medium text-white disabled:opacity-60",
  secondary: "border border-[var(--border)] bg-surface font-medium",
  ghost: "border border-[var(--border)]",
  danger: "border border-[var(--border)] font-medium text-critical",
  link: "text-accent",
} as const;

const SIZE = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
};

/**
 * Shared button. Variants match the class strings previously copy-pasted
 * across pages (`rounded-control bg-accent … text-white`, bordered secondary, etc.).
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        variant === "link" ? "text-sm" : cn("rounded-control", SIZE[size]),
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
