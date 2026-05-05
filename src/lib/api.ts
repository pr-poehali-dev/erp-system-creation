/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = "https://functions.poehali.dev/73735141-dfc6-4557-8541-c9c5d55a9650";

async function request<T = any>(route: string, method = "GET", body?: object, extra?: Record<string, string>): Promise<T> {
  const params: Record<string, string> = { r: route, ...extra };
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/?${qs}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = JSON.parse(text);
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!res.ok) throw new Error(parsed.error || "Ошибка сервера");
  return parsed as T;
}

export const api = {
  dashboard: () => request<DashboardData>("dashboard"),
  clients: () => request<Client[]>("clients"),
  staff: (role?: string) => request<Staff[]>("staff", "GET", undefined, role ? { role } : {}),

  deals: {
    list: () => request<Deal[]>("deals"),
    create: (body: object) => request<any>("deals", "POST", body),
    updateStage: (deal_id: number, stage: string) =>
      request<any>("deals", "POST", { action: "update_stage", deal_id, stage }),
  },

  projects: {
    list: () => request<Project[]>("projects"),
  },

  procurement: {
    list: () => request<MaterialRequest[]>("procurement"),
    create: (body: object) => request<any>("procurement", "POST", body),
    updateStatus: (id: number, status: string) =>
      request<any>("procurement", "POST", { action: "update_status", id, status }),
  },

  payments: {
    list: () => request<Payment[]>("payments"),
    pl: () => request<PLSummary>("payments", "GET", undefined, { action: "pl" }),
    create: (body: object) => request<any>("payments", "POST", body),
  },

  kcompany: {
    last: () => request<KCompany>("kcompany"),
    calc: () => request<KCompany>("kcompany", "GET", undefined, { action: "calc" }),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
}

export interface Staff {
  id: number;
  name: string;
  role: string;
}

export interface Deal {
  id: number;
  code: string;
  stage: string;
  budget: number;
  start_date: string;
  source: string;
  notes: string;
  created_at: string;
  client_name: string;
  client_phone: string;
  manager_name: string;
  realtor_name: string | null;
  slot_id: number;
  slot_year: number;
  slot_month: number;
  project_id: number | null;
}

export interface ProjectStage {
  id: number;
  name: string;
  order_num: number;
  duration_days: number;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
}

export interface Project {
  id: number;
  code: string;
  start_date: string;
  deadline: string;
  status: string;
  brigade: string | null;
  total_cost: number;
  client_name: string;
  client_phone: string;
  address: string | null;
  total_stages: number;
  done_stages: number;
  progress: number;
  days_left: number;
  stages: ProjectStage[];
}

export interface MaterialRequest {
  id: number;
  code: string;
  material: string;
  quantity: number;
  unit: string;
  required_date: string;
  priority: string;
  status: string;
  notes: string;
  created_at: string;
  project_code: string;
  foreman_name: string;
}

export interface Payment {
  id: number;
  code: string;
  type: string;
  category: string;
  amount: number;
  payment_date: string;
  description: string;
  project_code: string | null;
  deal_code: string | null;
  created_by_name: string | null;
}

export interface PLSummary {
  income: number;
  expense: number;
  profit: number;
  margin: number;
  rows: { type: string; category: string; total: number }[];
}

export interface KCompany {
  date?: string;
  calc_date?: string;
  k_total: number;
  k_sales: number;
  k_production: number;
  k_speed: number;
  k_turnover: number;
  sales_fact: number;
  sales_plan: number;
  houses_fact: number;
  houses_plan: number;
  avg_duration_days: number;
  alert?: boolean;
  alert_sent?: boolean;
}

export interface DashboardData {
  active_deals: number;
  active_projects: number;
  revenue_month: number;
  pending_requests: number;
  k_company: KCompany | null;
}
