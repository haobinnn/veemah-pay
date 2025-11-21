"use client";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({ open, onClose, children }:{ open: boolean; onClose: () => void; children?: React.ReactNode }){
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="btn ghost modal-close" aria-label="Close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>,
    document.body
  );
}