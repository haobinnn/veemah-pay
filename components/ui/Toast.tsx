"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type ToastItem = { id: number; message: string; type?: "success" | "error" | "info" };

const ToastCtx = createContext<{ show: (message: string, type?: ToastItem["type"]) => void } | null>(null);

export function ToastProvider({ children }:{ children: React.ReactNode }){
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = (message: string, type?: ToastItem["type"]) => {
    const id = Date.now();
    setItems(prev => [...prev, { id, message, type }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 3000);
  };
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="toast-viewport">
        {items.map(i => (
          <div key={i.id} className={`toast ${i.type ?? "info"}`}>{i.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(){
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}