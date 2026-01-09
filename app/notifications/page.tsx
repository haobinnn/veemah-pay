"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/nav/Header";
import { useLanguage } from "@/components/ui/LanguageProvider";
import { useAuth } from "@/components/ui/AuthProvider";

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

export default function NotificationsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { me, refreshMe } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const listLoadingRef = useRef(false);

  const readJson = useCallback(async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchNotifications = useCallback(
    async (reset: boolean) => {
      if (listLoadingRef.current) return;
      listLoadingRef.current = true;
      setListLoading(true);
      setError(null);
      try {
        const u = new URL("/api/notifications", window.location.origin);
        u.searchParams.set("limit", "30");
        const currentCursor = cursorRef.current;
        if (!reset && currentCursor) u.searchParams.set("cursor", currentCursor);
        const res = await fetch(u.toString(), { cache: "no-store" });
        const data: any = await readJson(res);
        const next = typeof data?.next_cursor === "string" ? data.next_cursor : null;
        const rows = Array.isArray(data?.notifications) ? data.notifications : [];
        const unread = Number(data?.unreadCount ?? 0);

        if (!res.ok) {
          setError(data?.error || t("inbox.error"));
          if (reset) {
            setItems([]);
            cursorRef.current = null;
            setCursor(null);
            setUnreadCount(0);
          }
          return;
        }

        cursorRef.current = next;
        setCursor(next);
        setUnreadCount(unread);
        setItems((prev) => (reset ? rows : [...prev, ...rows]));
      } catch (e: any) {
        setError(e?.message || t("inbox.error"));
      } finally {
        listLoadingRef.current = false;
        setListLoading(false);
      }
    },
    [readJson, t]
  );

  const markRead = useCallback(
    async (id: number) => {
      setError(null);
      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "READ" }),
        });
        const data: any = await readJson(res);
        if (!res.ok) {
          setError(data?.error || t("inbox.error"));
          return;
        }
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "READ", read_at: n.read_at ?? new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e: any) {
        setError(e?.message || t("inbox.error"));
      }
    },
    [readJson, t]
  );

  const markAllRead = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        setError(data?.error || t("inbox.error"));
        return;
      }
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => (n.status === "UNREAD" ? { ...n, status: "READ", read_at: n.read_at ?? new Date().toISOString() } : n)));
    } catch (e: any) {
      setError(e?.message || t("inbox.error"));
    }
  }, [readJson, t]);

  useEffect(() => {
    let active = true;
    refreshMe()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;
    if (!me?.authenticated) {
      router.replace("/login");
      return;
    }
    fetchNotifications(true);
  }, [fetchNotifications, loading, me?.authenticated, router]);

  return (
    <main>
      <Header />
      <div className="inner container" style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t("inbox.all_notifications")}</h2>
          <div className="notif-modal-actions">
            <button className="btn ghost" onClick={() => fetchNotifications(true)} disabled={listLoading}>{t("admin.refresh")}</button>
            <button className="btn" onClick={markAllRead} disabled={listLoading || unreadCount === 0}>{t("inbox.mark_all_read")}</button>
          </div>
        </div>

        {error && <div className="toast error" style={{ position: "static" }}>{error}</div>}
        {!error && loading && <div className="muted">{t("inbox.loading")}</div>}
        {!loading && items.length === 0 && !listLoading && <div className="muted">{t("inbox.empty")}</div>}

        <div className="notif-list" style={{ maxHeight: "none" }}>
          {items.map((n) => {
            const when = n.created_at ? new Date(n.created_at).toLocaleString() : "";
            const isUnread = n.status === "UNREAD";
            return (
              <div key={n.id} className={`notif-item ${isUnread ? "unread" : ""}`}>
                <div className="notif-item-head">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-actions">
                    {isUnread ? (
                      <button className="btn ghost" onClick={() => markRead(n.id)} disabled={listLoading}>{t("inbox.mark_read")}</button>
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

        {cursor && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
            <button className="btn" onClick={() => fetchNotifications(false)} disabled={listLoading}>{t("inbox.load_more")}</button>
          </div>
        )}
      </div>
    </main>
  );
}
