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
      <img className="lm-logo__mark" src="/icon.svg" width="30" height="30" alt="" aria-hidden="true" />
      {compact ? <span className="lm-sr-only">{label}</span> : <strong>{label}</strong>}
    </span>
  );
}
