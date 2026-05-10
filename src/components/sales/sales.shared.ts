// Общие константы и типы для модуля Sales
// Вынесены, чтобы не дублироваться между Sales.tsx и его дочерними компонентами.

import { Role } from "@/App";

export const KANBAN_STAGES = [
  { key: "lead",     label: "Новый лид",     color: "bg-blue-500",    icon: "UserPlus" },
  { key: "kp",       label: "КП отправлено", color: "bg-amber-500",   icon: "FileText" },
  { key: "planning", label: "Планирование",  color: "bg-emerald-500", icon: "CalendarCheck" },
];

export const SALES_ROLES: Role[] = ["director", "commercial", "crm_manager", "realtor"];
export const DIRECTOR_ROLES: Role[] = ["director", "commercial"];

export type StatusFilter = "active" | "closed" | "archived";
export type FunnelFilter = "all" | "managers" | "realtors";

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;
