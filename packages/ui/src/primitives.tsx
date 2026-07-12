import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "coral" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classNames("lm-button", `lm-button--${variant}`, `lm-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="lm-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { className, interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={classNames("lm-surface", interactive && "lm-surface--interactive", className)}
      {...props}
    />
  );
});

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={classNames("lm-badge", tone !== "neutral" && `lm-badge--${tone}`, className)}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("lm-skeleton", className)} aria-hidden="true" {...props} />;
}

export interface LogoProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  compact?: boolean;
  label?: ReactNode;
}

export function Logo({ compact = false, className, label = "Laminaria", ...props }: LogoProps) {
  return (
    <span
      className={classNames("lm-logo", className)}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.65rem", color: "inherit" }}
      {...props}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M15.2 4.2c-3 3.8-3.7 7.2-2 10.3 1.8 3.2 1 6.8-2.3 10.8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M21.6 6.8c-2.4 2.7-2.8 5.4-1.3 8.1 1.4 2.5 1 5.1-1.4 8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity=".72"
        />
        <path
          d="M8.8 8.2c-2 2.6-2.2 5.1-.7 7.4 1.2 2 1 4.3-.8 6.8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity=".5"
        />
        <path d="M4 17.5c6.1-2.1 15.3-2.1 22 0" stroke="currentColor" strokeWidth="1.4" opacity=".4" />
      </svg>
      {compact ? <span className="lm-sr-only">{label}</span> : <strong>{label}</strong>}
    </span>
  );
}
