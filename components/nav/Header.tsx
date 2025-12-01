"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import logo from "../../assets/img/veemahpay-logo.png";
import { ThemeToggle } from "@/components/ui/ThemeProvider";

type Me = { authenticated: boolean; account?: { account_number: string; name: string; balance: number; status: string } };

export function Header(){
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(setMe).catch(() => setMe({ authenticated: false } as any));
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
  };

  const NavLink = ({ href, label }:{ href: string; label: string }) => (
    <a href={href} className={pathname === href ? "active" : ""}>{label}</a>
  );

  const isAdmin = me?.authenticated && me?.account?.account_number === "0000";

  return (
    <header className={`site-header ${open ? "mobile-open" : ""}`}>
      <div className="inner container" style={{ justifyContent: "space-between" }}>
        <div className="brand"><Image src={logo} alt="VeemahPay" width={180} height={50} priority /></div>
        <nav className={`top-nav ${open ? "open" : ""}`}>
          <NavLink href="/" label="Home" />
          {!me?.authenticated && (
            <>
              <NavLink href="/login" label="Login" />
              <NavLink href="/signup" label="Sign Up" />
            </>
          )}
          {me?.authenticated && (
            <>
              {isAdmin ? <NavLink href="/admin" label="Admin" /> : <NavLink href="/user" label="Dashboard" />}
              <button className="btn ghost" onClick={logout}>Sign Out</button>
              <ThemeToggle />
              <div className="avatar" title={me?.account?.name ?? "User"}>{String(me?.account?.name ?? "U").slice(0,1).toUpperCase()}</div>
              <div className="quick-info">
                <span>{me?.account?.name}</span>
                <span className="muted">₱{Number(me?.account?.balance ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
          {!me?.authenticated && <ThemeToggle />}
        </nav>
        <button className="hamburger" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

