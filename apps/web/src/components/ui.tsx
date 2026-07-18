"use client";

import { Button, Logo, Surface, Skeleton, Badge, type ButtonProps } from "@laminaria/ui";
import { motion } from "motion/react";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";

export { Button, Logo, Surface, Skeleton, Badge };

export function MotionButton({ children, className, ...props }: ButtonProps) {
  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} className={className}>
      <Button {...props}>{children}</Button>
    </motion.div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input(props: ComponentPropsWithoutRef<"input">) {
  return <input className={`input ${props.className ?? ""}`} {...props} />;
}

export function Textarea(props: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`input textarea ${props.className ?? ""}`} {...props} />;
}

export function Select(props: ComponentPropsWithoutRef<"select">) {
  return <select className={`input select ${props.className ?? ""}`} {...props} />;
}

export function ServiceState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="service-state" role="status">
      <span className="service-state__icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action ? <div className="service-state__action">{action}</div> : null}
    </div>
  );
}
