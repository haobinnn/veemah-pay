"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { 
  authenticated: boolean; 
  account?: { 
    account_number: string; 
    name: string; 
    balance: number; 
    status: string;
    email?: string;
    role?: string;
    hasPassword?: boolean;
  };
  isAdmin?: boolean;
};

type AuthContextType = {
  me: Me | null;
  setMe: React.Dispatch<React.SetStateAction<Me | null>>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, initialMe }: { 
  children: React.ReactNode; 
  initialMe: Me | null;
}) {
  const [me, setMe] = useState<Me | null>(initialMe || { authenticated: false });
  const router = useRouter();

  // Sync with server-provided initialMe after hydration, but don't override client updates
  useEffect(() => {
    // Only set initialMe if we haven't been initialized yet or if there's a significant change
    if (initialMe && me && initialMe.authenticated !== me.authenticated) {
      setMe(initialMe);
    } else if (!me && initialMe) {
      setMe(initialMe);
    }
  }, [initialMe]); // Removed me?.authenticated dependency to prevent loops

  const logout = useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      setMe({ authenticated: false });
      router.replace("/");
    } catch (error) {
      console.error('Logout error:', error);
      // Still set to false even if API call fails
      setMe({ authenticated: false });
      router.replace("/");
    }
  }, [router]);

  // Refresh user data when needed
  const refreshMe = useCallback(async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      setMe(data);
    } catch (error) {
      setMe({ authenticated: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ me, setMe, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
