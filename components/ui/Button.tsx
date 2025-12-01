"use client";
import React from "react";
import { Icon } from "./Icon";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export function Button({ children, onClick, disabled, variant = "default", size = "md", ariaLabel, leftIcon, rightIcon, className, type = "button" }:
  { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: Variant; size?: Size; ariaLabel?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; className?: string; type?: "button" | "submit" }) {
  const cls = ["btn", variant === "primary" ? "primary" : variant === "danger" ? "danger" : variant === "ghost" ? "ghost" : ""].join(" ");
  return (
    <button type={type} aria-label={ariaLabel} className={`${cls} ${className ?? ""}`} onClick={onClick} disabled={disabled}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

export function IconButton({ ariaLabel, onClick, disabled, icon, variant = "ghost" }:
  { ariaLabel: string; onClick?: () => void; disabled?: boolean; icon: "sun" | "moon" | "info"; variant?: Variant }) {
  return (
    <button aria-label={ariaLabel} className={`btn ${variant}`} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

