// Общие константы, типы и хелперы для клиентского портала

export const PROJECT_STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  planning: { label: "Планирование",  cls: "bg-blue-100 text-blue-700 border-blue-200",         icon: "ClipboardList" },
  active:   { label: "Строительство", cls: "bg-amber-100 text-amber-700 border-amber-200",      icon: "HardHat" },
  done:     { label: "Сдан",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "CheckCircle2" },
  archived: { label: "Архив",         cls: "bg-gray-100 text-gray-600 border-gray-200",          icon: "Archive" },
};

export const STAGE_CFG: Record<string, { label: string; badgeCls: string; dotCls: string }> = {
  done:        { label: "Завершён",    badgeCls: "bg-emerald-100 text-emerald-700", dotCls: "bg-emerald-500"  },
  in_progress: { label: "Выполняется", badgeCls: "bg-amber-100 text-amber-700",    dotCls: "bg-amber-400"    },
  overdue:     { label: "Просрочен",   badgeCls: "bg-red-100 text-red-700",         dotCls: "bg-red-500"      },
  pending:     { label: "Ожидает",     badgeCls: "bg-gray-100 text-gray-500",       dotCls: "bg-gray-300"     },
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

export function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export type PortalTab = "main" | "plan";
