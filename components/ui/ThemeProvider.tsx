"use client";
import React, { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeProvider({ children }:{ children: React.ReactNode }){
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark"; // Default to dark on server
    
    // Get the theme that was set by the script in layout.tsx
    const currentTheme = document.documentElement.getAttribute("data-theme") as Theme;
    if (currentTheme === "light") {
      return "light";
    }
    
    // Default to dark (matching CSS default)
    return "dark";
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useLayoutEffect(() => {    
    // Set the theme attribute if needed
    const currentAttr = document.documentElement.getAttribute("data-theme") as Theme;
    if (theme === "light" && currentAttr !== "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (theme === "dark" && currentAttr === "light") {
      document.documentElement.removeAttribute("data-theme");
    }
    
    // Save to localStorage
    window.localStorage.setItem("theme", theme);

    if (isInitialLoad) {
      // Add transitions class after initial theme is set
      const timer = setTimeout(() => {
        document.documentElement.classList.add("theme-transitions");
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Ensure transitions are enabled for manual theme changes
      document.documentElement.classList.add("theme-transitions");
    }
  }, [theme, isInitialLoad]);

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
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const next = theme === "dark" ? "light" : "dark";
  const label = mounted ? (theme === "dark" ? "☀️" : "🌙") : "🌓";
  return (
    <button className="btn ghost" aria-label="Toggle theme" onClick={() => setTheme(next)}>{label}</button>
  );
}
