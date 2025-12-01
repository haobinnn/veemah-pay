"use client";
import React from "react";

type IconName = "sun" | "moon" | "check" | "error" | "info";

export function Icon({ name, size = 18, color = "currentColor", className }: { name: IconName; size?: number; color?: string; className?: string }) {
  if (name === "sun") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2"/>
      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  if (name === "moon") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={color} strokeWidth="2" fill="none"/>
    </svg>
  );
  if (name === "check") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (name === "error") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 8v5M12 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 9.5a4 4 0 0 1 8 0c0 2.5-4 2-4 4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

