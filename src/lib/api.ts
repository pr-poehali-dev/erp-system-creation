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
    listArchived: () => request<Deal[]>("deals", "GET", undefined, { archived: "1" }),
    create: (body: object) => request<any>("deals", "POST", body),
    toKp: (deal_id: number, body: object) =>
      request<any>("deals", "POST", { action: "kp", deal_id, ...body }),
    toContract: (deal_id: number, body: object) =>
      request<any>("deals", "POST", { action: "contract", deal_id, ...body }),
    updateStage: (deal_id: number, stage: string, extra?: object) =>
      request<any>("deals", "POST", { action: "update_stage", deal_id, stage, ...extra }),
    archive: (deal_id: number) =>
      request<any>("deals", "POST", { action: "archive", deal_id }),
    restore: (deal_id: number) =>
      request<any>("deals", "POST", { action: "restore", deal_id }),
  },

  stage_durations: {
    list: () => request<StageDuration[]>("stage_durations"),
    update: (stage_num: number, duration_days: number) =>
      request<any>("stage_durations", "POST", { stage_num, duration_days }),
  },

  projects: {
    list: () => request<Project[]>("projects"),
    listArchived: () => request<Project[]>("projects", "GET", undefined, { archived: "1" }),
    archive: (project_id: number) =>
      request<any>("projects", "PUT", { action: "update_project", project_id, status: "archived" }),
    restore: (project_id: number) =>
      request<any>("projects", "PUT", { action: "update_project", project_id, status: "active" }),
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

  employees: {
    list: () => request<Employee[]>("employees"),
    create: (body: object) => request<any>("employees", "POST", body),
  },

  reports: {
    get: () => request<ReportsData>("reports"),
  },

  slots: {
    // signed_date: фильтрует только слоты >= signed_date + 15 дней
    free: (signed_date?: string) => request<SlotItem[]>("slots", "GET", undefined,
      signed_date ? { signed_date } : {}),
    plan: () => request<SlotMonth[]>("slots", "GET", undefined, { action: "plan" }),
    updateLimit: (year: number, month: number, monthly_limit: number) =>
      request<any>("slots", "POST", { year, month, monthly_limit }),
  },

  estimate: {
    get: (serial_project_id: number) =>
      request<EstimateData>("estimate", "GET", undefined, { serial_project_id: String(serial_project_id) }),
    saveWork: (body: object) => request<any>("estimate_works", "POST", body),
    saveMaterial: (body: object) => request<any>("estimate_materials", "POST", body),
  },

  serial_projects: {
    list: () => request<SerialProject[]>("serial_projects"),
    create: (body: object) => request<any>("serial_projects", "POST", body),
  },

  configurations: {
    list: (serial_project_id: number) =>
      request<Configuration[]>("configurations", "GET", undefined, { serial_project_id: String(serial_project_id) }),
    update: (id: number, body: object) =>
      request<any>("configurations", "POST", { action: "update", id, ...body }),
  },

  individual_requests: {
    list: () => request<IndividualRequest[]>("individual_requests"),
    update: (body: object) => request<any>("individual_requests", "POST", body),
  },

  contractors: {
    list: (type?: string) => request<Contractor[]>("contractors", "GET", undefined, type ? { type } : {}),
    create: (body: object) => request<any>("contractors", "POST", body),
    update: (id: number, body: object) => request<any>("contractors", "POST", { action: "update", id, ...body }),
  },

  documents: {
    list: (filters?: { category?: string; deal_id?: number; contractor_id?: number; project_id?: number }) =>
      request<Document[]>("documents", "GET", undefined,
        Object.fromEntries(Object.entries(filters || {}).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))),
    create: (body: object) => request<any>("documents", "POST", body),
    updateStatus: (id: number, status: string, file_url?: string, file_name?: string) =>
      request<any>("documents", "POST", { action: "update_status", id, status, file_url, file_name }),
  },

  doc_templates: {
    list: (showAll?: boolean) => request<DocTemplate[]>("doc_templates", "GET", undefined, showAll ? { all: "1" } : {}),
    create: (body: object) => request<any>("doc_templates", "POST", body),
    update: (id: number, body: object) => request<any>("doc_templates", "POST", { action: "update", id, ...body }),
  },

  contract_docs: {
    get: (deal_id: number) => request<ContractDocsPackage>("contract_docs", "GET", undefined, { deal_id: String(deal_id) }),
    upload: (deal_id: number, template_id: number, file_b64: string, file_name: string) =>
      request<any>("contract_docs", "POST", { action: "upload", deal_id, template_id, file_b64, file_name }),
    submitReview: (deal_id: number) =>
      request<any>("contract_docs", "POST", { action: "submit_review", deal_id }),
    approve: (deal_id: number, approved: boolean, reject_reason?: string) =>
      request<any>("contract_docs", "POST", { action: "approve", deal_id, approved, reject_reason }),
    confirmPayment: (deal_id: number) =>
      request<any>("contract_docs", "POST", { action: "confirm_payment", deal_id }),
    uploadSigned: (deal_id: number, template_id: number, file_b64: string, file_name: string) =>
      request<any>("contract_docs", "POST", { action: "upload_signed", deal_id, template_id, file_b64, file_name }),
    confirmDocPayment: (deal_id: number, template_id: number) =>
      request<any>("contract_docs", "POST", { action: "confirm_doc_payment", deal_id, template_id }),
  },

  payout_requests: {
    list: (manager_id?: number) =>
      request<{ deals: PayoutDeal[] }>("payout_requests", "GET", undefined, manager_id ? { manager_id: String(manager_id) } : {}),
    create: (body: object) =>
      request<any>("payout_requests", "POST", { action: "create", ...body }),
    update: (payout_id: number, status: string, reject_comment?: string) =>
      request<any>("payout_requests", "POST", { action: "update", payout_id, status, reject_comment }),
    resubmit: (body: object) =>
      request<any>("payout_requests", "POST", { action: "resubmit", ...body }),
  },

  notifications: {
    list: (role?: string, unread?: boolean) =>
      request<NotificationsResponse>("notifications", "GET", undefined,
        { ...(role ? { role } : {}), ...(unread ? { unread: "1" } : {}) }),
    markRead: (ids: number[]) =>
      request<any>("notifications", "POST", { action: "read", ids }),
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
  stage: string; // lead | kp | contract | planning | lost
  budget: number;
  start_date: string;
  source: string;
  notes: string;
  created_at: string;
  client_name: string;
  client_phone: string;
  manager_name: string;
  realtor_name: string | null;
  slot_id: number | null;
  slot_year: number | null;
  slot_month: number | null;
  project_id: number | null;
  project_type: string; // serial | individual
  serial_project_id: number | null;
  serial_project_name: string | null;
  configuration_id: number | null;
  configuration_name: string | null;
  configuration_duration: number | null;
  price_coefficient: number | null;
  selected_stages: number[] | null;
  signed_date: string | null;
  buffer_days: number;
  kp_notes: string | null;
  address: string | null;
  planned_start_date: string | null;
  contract_status: string; // none | docs_uploaded | docs_review | docs_approved | payment_pending | payment_confirmed
  slot_start_date: string | null;
  is_archived: boolean;
}

export interface StageDuration {
  stage_num: number;
  name: string;
  duration: number;
  parallel_group: number | null;
  depends_on: number[];
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
  // Данные из сделки (для директора по строительству)
  deal_code: string | null;
  deal_budget: number | null;
  signed_date: string | null;
  contract_status: string | null;
  manager_name: string | null;
  serial_project_name: string | null;
  configuration_name: string | null;
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

export interface Employee {
  id: number;
  name: string;
  role: string;
  dept: string;
  kpi: number;
  deals_count: number | null;
  contracts_count?: number;
  active_projects?: number;
}

export interface ReportsKPI {
  name: string;
  value: string;
  target: string;
  status: "success" | "warning" | "error";
  trend: string;
}

export interface ReportsManager {
  id: number;
  name: string;
  role: string;
  leads: number;
  contracts: number;
  revenue: number;
  conversion: number;
  kpi: number;
}

export interface ReportsBrigade {
  id: number;
  name: string;
  total_projects: number;
  done_projects: number;
  avg_days: number;
  rating: number;
}

export interface ReportsData {
  kpis: ReportsKPI[];
  managers: ReportsManager[];
  brigades: ReportsBrigade[];
  summary: {
    active_deals: number;
    contracts: number;
    conversion: number;
    active_projects: number;
    avg_duration: number;
    income: number;
    expense: number;
    margin: number;
  };
  req_stats: Record<string, { count: number; qty: number }>;
}

export interface SlotItem {
  id: number;
  year: number;
  month: number;
  start_date: string;
  status: string;
  monthly_limit: number;
  occupied_count: number;
  available: boolean;
}

export interface SlotMonth {
  year: number;
  month: number;
  monthly_limit: number;
  free_count: number;
  booked_count: number;
  busy_count: number;
  total_occupied: number;
  load_pct: number;
  overloaded: boolean;
}

export interface Configuration {
  id: number;
  name: string;
  description: string;
  price_coefficient: number;
  duration_days: number;
  included_stages: number[];
  discount_pct: number;
  discount_until: string | null;
  is_popular: boolean;
}

export interface SerialProject {
  id: number;
  name: string;
  area_sqm: number;
  base_price: number;
  base_duration_days: number;
  description: string;
  is_active: boolean;
  config_count: number;
  configurations: Configuration[];
}

export interface IndividualRequest {
  id: number;
  deal_id: number;
  deal_code: string;
  client_name: string;
  desired_area: number;
  special_requests: string;
  status: string;
  design_deadline: string | null;
  estimate_file_url: string | null;
  created_at: string;
}

export interface EstimateWork {
  id: number;
  stage_num: number;
  work_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  notes: string;
  sort_order: number;
}

export interface EstimateMaterial {
  id: number;
  stage_num: number;
  material_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  supplier_hint: string;
  notes: string;
  sort_order: number;
}

export interface EstimateStage {
  stage_num: number;
  stage_name: string;
  works: EstimateWork[];
  materials: EstimateMaterial[];
  works_total: number;
  mats_total: number;
  stage_total: number;
}

export interface EstimateData {
  stages: EstimateStage[];
  total_works: number;
  total_materials: number;
  grand_total: number;
}

export interface Contractor {
  id: number;
  contractor_type: string; // client | supplier | contractor | subcontractor | internal | general
  type_label: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  legal_address: string | null;
  actual_address: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bik: string | null;
  corr_account: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Document {
  id: number;
  doc_type: string;
  doc_type_label: string;
  category: string; // deal | supply | contractor | internal | general
  title: string;
  status: string; // draft | sent | signed | paid | cancelled | active
  amount: number | null;
  doc_date: string | null;
  deal_id: number | null;
  deal_code: string | null;
  project_id: number | null;
  project_code: string | null;
  contractor_id: number | null;
  contractor_name: string | null;
  contractor_type: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size_kb: number | null;
  notes: string | null;
  created_at: string;
}

export interface DocTemplate {
  id: number;
  name: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  file_url: string | null;
  file_name: string | null;
  file_size_kb: number | null;
  file_updated_at: string | null;
  is_active: boolean;
  created_at: string;
  version: number;
  prev_file_url: string | null;
  prev_file_name: string | null;
}

export interface ContractDocItem {
  template_id: number;
  template_name: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  template_version: number;
  template_file_url: string | null;
  template_file_name: string | null;
  doc_id: number | null;
  file_url: string | null;
  file_name: string | null;
  status: string; // pending | uploaded | review | approved | rejected
  uploaded_at: string | null;
  // Подписанный директором вариант
  signed_file_url: string | null;
  signed_file_name: string | null;
  signed_at: string | null;
  manager_seen_signed: boolean;
}

export interface ContractDocsPackage {
  items: ContractDocItem[];
  all_required_done: boolean;
  total: number;
  uploaded_count: number;
  contract_status: string; // none | docs_uploaded | docs_review | docs_approved | payment_pending | payment_confirmed
}

export interface Notification {
  id: number;
  type: string; // docs_for_review | docs_approved | docs_rejected | payment_pending | payment_confirmed
  title: string;
  body: string | null;
  role: string | null;
  staff_id: number | null;
  deal_id: number | null;
  deal_code: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface PayoutDeal {
  id: number;
  code: string;
  budget: number;
  contract_status: string;
  signed_date: string | null;
  client_name: string;
  client_phone: string;
  manager_name: string;
  serial_project_name: string | null;
  project_id: number | null;
  payout_id: number | null;
  payout_status: string | null; // pending | approved | rejected
  payout_amount: number | null;
  requested_at: string | null;
  notes: string | null;
  invoice_file_url: string | null;
  invoice_file_name: string | null;
  reject_comment: string | null;
}