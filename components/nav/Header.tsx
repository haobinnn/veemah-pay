"use client";
import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logo from "../../assets/img/veemahpay-logo.png";
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { LanguageToggle, useLanguage } from "@/components/ui/LanguageProvider";
import { useAuth } from "@/components/ui/AuthProvider";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Modal } from "@/components/ui/Modal";

export function Header(){
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { me, logout } = useAuth();

  type NotificationItem = {
    id: number;
    type: string;
    title: string;
    body: string | null;
    status: "UNREAD" | "READ";
    created_at: string;
    updated_at: string;
    read_at: string | null;
    metadata: any;
  };

  const NavLink = ({ href, label }:{ href: string; label: string }) => (
    <Link href={href} className={pathname === href ? "active" : ""}>{label}</Link>
  );

  const isAdmin = !!me?.authenticated && !!me?.isAdmin;
  const isAuthed = !!me?.authenticated;

  const [inboxOpen, setInboxOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const readJson = async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthed) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await fetch(`/api/notifications?limit=30`, { cache: "no-store" });
      const data: any = await readJson(res);
      if (!res.ok) {
        setNotifError(data?.error || t("inbox.error"));
        return;
      }
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unreadCount ?? 0));
    } catch (e: any) {
      setNotifError(e?.message || t("inbox.error"));
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthed) {
      setInboxOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      setNotifError(null);
      return;
    }
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    if (inboxOpen) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxOpen]);

  const markRead = async (id: number) => {
    if (!isAuthed) return;
    setNotifError(null);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READ" }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        setNotifError(data?.error || t("inbox.error"));
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ", read_at: n.read_at ?? new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e: any) {
      setNotifError(e?.message || t("inbox.error"));
    }
  };

  const markAllRead = async () => {
    if (!isAuthed) return;
    setNotifError(null);
    try {
      const res = await fetch(`/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        setNotifError(data?.error || t("inbox.error"));
        return;
      }
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => (n.status === "UNREAD" ? { ...n, status: "READ", read_at: n.read_at ?? new Date().toISOString() } : n))
      );
    } catch (e: any) {
      setNotifError(e?.message || t("inbox.error"));
    }
  };

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount <= 99) return String(unreadCount);
    return "99+";
  }, [unreadCount]);

  return (
    <header className={`site-header ${open ? "mobile-open" : ""}`}>
      <div className="inner container" style={{ justifyContent: "space-between" }}>
        <div className="brand">
          <Link href="/" aria-label="Go to Home">
            <Image src={logo} alt="VeemahPay" width={180} height={50} priority />
          </Link>
        </div>
        <nav className={`top-nav ${open ? "open" : ""}`}>
          {!me?.authenticated && <NavLink href="/" label={t('nav.home')} />}
          {!me?.authenticated && (
            <>
              <NavLink href="/login" label={t('nav.login')} />
              <NavLink href="/signup" label={t('nav.signup')} />
            </>
          )}
          {me?.authenticated && (
            <>
              {isAdmin ? <NavLink href="/admin" label={t('nav.admin')} /> : <NavLink href="/user" label={t('nav.dashboard')} />}
              {!isAdmin && <NavLink href="/transactions" label={t("nav.transactions")} />}
              <NavLink href="/settings" label={t("nav.settings")} />
              <button className="btn ghost notif-bell" aria-label={t("nav.inbox")} title={t("nav.inbox")} onClick={() => setInboxOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {unreadCount > 0 && <span className="notif-badge" aria-label={unreadLabel}>{unreadLabel}</span>}
              </button>
              <button className="btn ghost" onClick={logout}>{t('nav.signout')}</button>
              <ThemeToggle />
              <LanguageToggle />
              <div className="avatar" title={me?.account?.name ?? "User"}>{String(me?.account?.name ?? "U").slice(0,1).toUpperCase()}</div>
              <div className="quick-info">
                <span>{me?.account?.name}</span>
                {!isAdmin && (
                  <span className="muted">
                    <MoneyDisplay amount={me?.account?.balance ?? 0} />
                  </span>
                )}
              </div>
            </>
          )}
          {!me?.authenticated && (
            <>
              <ThemeToggle />
              <LanguageToggle />
            </>
          )}
        </nav>
        <button className="hamburger" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <span />
          <span />
          <span />
        </button>
      </div>

      <Modal open={inboxOpen} onClose={() => setInboxOpen(false)}>
        <div className="notif-modal">
          <div className="notif-modal-head">
            <h2 style={{ margin: 0 }}>{t("inbox.title")}</h2>
            <div className="notif-modal-actions">
              <button className="btn ghost" onClick={fetchNotifications} disabled={notifLoading}>{t("admin.refresh")}</button>
              <Link href="/notifications" className="btn ghost" onClick={() => setInboxOpen(false)}>{t("inbox.view_all")}</Link>
              <button className="btn" onClick={markAllRead} disabled={notifLoading || unreadCount === 0}>{t("inbox.mark_all_read")}</button>
            </div>
          </div>
          {notifError && <div className="toast error" style={{ position: "static" }}>{notifError}</div>}
          {notifLoading && <div className="muted">{t("inbox.loading")}</div>}
          {!notifLoading && notifications.length === 0 && <div className="muted">{t("inbox.empty")}</div>}
          <div className="notif-list">
            {notifications.map((n) => {
              const when = n.created_at ? new Date(n.created_at).toLocaleString() : "";
              const isUnread = n.status === "UNREAD";
              return (
                <div key={n.id} className={`notif-item ${isUnread ? "unread" : ""}`}>
                  <div className="notif-item-head">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-actions">
                      {isUnread ? (
                        <button className="btn ghost" onClick={() => markRead(n.id)} disabled={notifLoading}>{t("inbox.mark_read")}</button>
                      ) : (
                        <span className="muted">{t("inbox.read")}</span>
                      )}
                    </div>
                  </div>
                  {n.body && <div>{n.body}</div>}
                  <div className="notif-meta">
                    <span>{when}</span>
                    <span>{String(n.type || "").toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </header>
  );
}
