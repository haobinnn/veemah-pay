"use client";
import React, { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeProvider({ children }:{ children: React.ReactNode }){
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("theme") as Theme | null : null;
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      window.localStorage.setItem("theme", theme);
    }
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const ThemeContext = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function useTheme(){
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing");
  return ctx;
}

export function ThemeToggle(){
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="btn ghost" aria-label="Toggle theme" onClick={() => setTheme(next)}>{theme === "dark" ? "☀️" : "🌙"}</button>
  );
}