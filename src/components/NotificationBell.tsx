import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, Notification } from "@/lib/api";
import { Role } from "@/App";

const TYPE_ICON: Record<string, string> = {
  docs_for_review:    "FileSearch",
  docs_approved:      "CheckCircle",
  docs_rejected:      "XCircle",
  payment_pending:    "Clock",
  payment_confirmed:  "BadgeCheck",
};
const TYPE_COLOR: Record<string, string> = {
  docs_for_review:    "text-blue-500",
  docs_approved:      "text-emerald-500",
  docs_rejected:      "text-red-500",
  payment_pending:    "text-amber-500",
  payment_confirmed:  "text-emerald-600",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface Props { role: Role; }

export default function NotificationBell({ role }: Props) {
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState<Notification[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    api.notifications.list(role).then(res => {
      setNotifs(res.notifications);
      setUnread(res.unread_count);
    }).finally(() => setLoading(false));
  };

  // Подгружаем каждые 30 секунд
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [role]);

  // Закрываем при клике вне
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unread > 0) {
      const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length) {
        api.notifications.markRead(unreadIds).then(() => {
          setUnread(0);
          setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
        });
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors">
        <Icon name="Bell" size={18} className="text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold">Уведомления</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={15} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifs.length === 0 ? (
              <div className="p-4 space-y-2">
                {[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center text-hint py-10">
                <Icon name="Bell" size={28} className="mx-auto mb-2 opacity-30" />
                <div className="text-[13px]">Нет уведомлений</div>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${!n.is_read ? "bg-blue-50/40" : ""}`}>
                  <div className={`shrink-0 mt-0.5 ${TYPE_COLOR[n.type] || "text-muted-foreground"}`}>
                    <Icon name={(TYPE_ICON[n.type] || "Bell") as Parameters<typeof Icon>[0]["name"]} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground leading-tight">{n.title}</div>
                    {n.body && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{n.body}</div>}
                    <div className="text-[10px] text-hint mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                </div>
              ))
            )}
          </div>

          {notifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border">
              <button onClick={load} className="text-[12px] text-primary hover:underline flex items-center gap-1">
                <Icon name="RefreshCw" size={11} />Обновить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
