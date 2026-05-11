/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = "https://functions.poehali.dev/73735141-dfc6-4557-8541-c9c5d55a9650";

export function setCurrentUser(role: string, userId: number | null) {
  try {
    localStorage.setItem("current_role", role);
    if (userId != null) localStorage.setItem("current_user_id", String(userId));
    else localStorage.removeItem("current_user_id");
  } catch { /* ignore */ }
}

export function getCurrentUser(): { role: string | null; userId: number | null } {
  try {
    const role = localStorage.getItem("current_role");
    const idStr = localStorage.getItem("current_user_id");
    return { role, userId: idStr ? Number(idStr) : null };
  } catch {
    return { role: null, userId: null };
  }
}

async function request<T = any>(route: string, method = "GET", body?: object, extra?: Record<string, string>): Promise<T> {
  const params: Record<string, string> = { r: route, ...extra };
  const qs = new URLSearchParams(params).toString();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { role, userId } = getCurrentUser();
  if (role) headers["X-User-Role"] = role;
  if (userId != null) headers["X-User-Id"] = String(userId);
  const res = await fetch(`${BASE}/?${qs}`, {
    method,
    headers,
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
  clientCreate: (body: { name: string; phone: string; email?: string; source?: string }) =>
    request<Client>("clients", "POST", { action: "create", ...body }),
  staff: (role?: string) => request<Staff[]>("staff", "GET", undefined, role ? { role } : {}),
  realtorsReport: () => request<RealtorsReport>("realtors_report"),

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
    // КП-флоу
    saveKpSlot: (deal_id: number, kp_slot_id: number) =>
      request<any>("deals", "POST", { action: "save_kp_slot", deal_id, kp_slot_id }),
    confirmKpContract: (deal_id: number) =>
      request<any>("deals", "POST", { action: "confirm_kp_contract", deal_id }),
    confirmKpPayment: (deal_id: number) =>
      request<any>("deals", "POST", { action: "confirm_kp_payment", deal_id }),
    toPlanning: (deal_id: number) =>
      request<any>("deals", "POST", { action: "to_planning", deal_id }),
    delete: (deal_id: number) =>
      request<any>("deals", "POST", { action: "delete", deal_id }),
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
    approve: (project_id: number) =>
      request<any>("projects", "PUT", { action: "approve_project", project_id }),
    cancel: (project_id: number) =>
      request<any>("projects", "PUT", { action: "cancel_project", project_id }),
    complete: (project_id: number) =>
      request<any>("projects", "PUT", { action: "complete_project", project_id }),
    updateAddress: (project_id: number, address: string) =>
      request<any>("projects", "PUT", { action: "update_project", project_id, address }),
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
    free: (signed_date?: string) => request<SlotItem[]>("slots", "GET", undefined,
      signed_date ? { signed_date } : {}),
    plan: (show_archived?: boolean) => request<SlotPlan>("slots", "GET", undefined,
      { action: "plan", ...(show_archived ? { show_archived: "1" } : {}) }),
    updateLimit: (year: number, month: number, monthly_limit: number) =>
      request<any>("slots", "POST", { action: "update_limit", year, month, monthly_limit }),
    createSlots: (year: number, month: number, count: number, monthly_limit: number) =>
      request<any>("slots", "POST", { action: "create_slots", year, month, count, monthly_limit }),
    deleteSlot: (slot_id: number) =>
      request<any>("slots", "POST", { action: "delete_slot", slot_id }),
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

  gantt: {
    list: (project_id: number) => request<GanttStage[]>("gantt_stages", "GET", undefined, { project_id: String(project_id) }),
    updateProgress: (stage_id: number, progress_percent: number) =>
      request<any>("gantt_stages", "POST", { action: "update_progress", stage_id, progress_percent }),
    addGroup: (project_id: number, body: object) =>
      request<any>("gantt_stages", "POST", { action: "add_group", project_id, ...body }),
    addSubstage: (project_id: number, body: object) =>
      request<any>("gantt_stages", "POST", { action: "add_substage", project_id, ...body }),
    deleteStage: (stage_id: number) =>
      request<any>("gantt_stages", "POST", { action: "delete_stage", stage_id }),
  },

  suppliers: {
    list: () => request<Supplier[]>("suppliers"),
    create: (body: object) => request<any>("suppliers", "POST", body),
    update: (id: number, body: object) => request<any>("suppliers", "POST", { action: "update", id, ...body }),
    importCsv: (rows: object[]) => request<any>("suppliers", "POST", { action: "import_csv", rows }),
  },

  materials: {
    list: () => request<Material[]>("materials"),
    create: (body: object) => request<any>("materials", "POST", body),
    update: (id: number, body: object) => request<any>("materials", "POST", { action: "update", id, ...body }),
  },

  invoices: {
    list: () => request<Invoice[]>("invoices"),
    create: (body: object) => request<any>("invoices", "POST", body),
    update: (id: number, body: object) => request<any>("invoices", "POST", { action: "update", id, ...body }),
  },

  purchase_requests: {
    list: () => request<PurchaseRequest[]>("purchase_requests"),
    create: (body: object) => request<any>("purchase_requests", "POST", body),
    update: (id: number, body: object) => request<any>("purchase_requests", "POST", { action: "update", id, ...body }),
  },

  purchase_plan: {
    list: () => request<PurchasePlan[]>("purchase_plan"),
    create: (body: object) => request<any>("purchase_plan", "POST", body),
    delete: (id: number) => request<any>("purchase_plan", "POST", { action: "delete", id }),
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

  client_portal: {
    get: (token: string) =>
      request<ClientPortalData>("client_portal", "GET", undefined, { token }),
    signAct: (act_id: number) =>
      request<any>("client_portal", "POST", { action: "sign_act", act_id }),
    getToken: (deal_id: number) =>
      request<{ client_token: string }>("client_portal", "POST", { action: "get_token", deal_id }),
    createAct: (project_id: number, stage_id: number, amount: number, title: string) =>
      request<ClientAct>("client_portal", "POST", { action: "create_act", project_id, stage_id, amount, title }),
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
  closed_deals_count?: number;
  qualification?: "novice" | "inTopic" | "pro";
}

export interface RealtorReportRow {
  id: number;
  name: string;
  qualification: "novice" | "inTopic" | "pro";
  closed_deals_count: number;
  closed_count: number;
  open_count: number;
  closed_revenue: number;
  commission_total: number;
  open_revenue: number;
  next_level: "inTopic" | "pro" | null;
  to_next: number;
  next_rate: number | null;
}

export interface RealtorsReport {
  realtors: RealtorReportRow[];
  totals: {
    realtors: number;
    closed_total: number;
    revenue_total: number;
    commission_total: number;
  };
}

export interface Deal {
  id: number;
  code: string;
  stage: string; // lead | kp | contract | payment | active | done | lost
  budget: number;
  start_date: string;
  source: string;
  notes: string;
  created_at: string;
  client_name: string;
  client_phone: string;
  manager_id: number | null;
  manager_name: string;
  realtor_id: number | null;
  realtor_name: string | null;
  commission_rate: number | null;
  commission_amount: number | null;
  closed_at: string | null;
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
  slot_status: string | null; // free | booked | busy | archived
  is_archived: boolean;
  // КП-флоу
  kp_slot_id: number | null;
  kp_slot_start_date: string | null;
  kp_slot_year: number | null;
  kp_slot_month: number | null;
  payment_confirmed: boolean;
  contract_signed: boolean;
  client_token: string | null;
  last_reject_reason: string | null;
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
  status: string; // planning | active | done | archived
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
  // Данные из сделки
  deal_id: number | null;
  deal_code: string | null;
  deal_budget: number | null;
  deal_stage: string | null;
  signed_date: string | null;
  contract_status: string | null;
  manager_name: string | null;
  serial_project_name: string | null;
  configuration_name: string | null;
  // Данные слота
  slot_id: number | null;
  slot_status: string | null; // free | booked | busy
  slot_start_date: string | null;
  // Клиентский токен для ЛК
  client_token: string | null;
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

export interface SlotDetail {
  id: number;
  year: number;
  month: number;
  start_date: string;
  status: string; // free | booked | busy | archived
  monthly_limit: number;
  deal_id: number | null;
  deal_code: string | null;
  client_name: string | null;
  project_id: number | null;
  project_code: string | null;
  project_status: string | null;
}

export interface SlotPlan {
  months: SlotMonth[];
  slots: SlotDetail[];
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
  last_reject_reason: string | null;
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

export interface ClientAct {
  id: number;
  code: string;
  title: string;
  amount: number;
  status: string; // pending_signature | signed
  signed_at: string | null;
  created_at: string;
}

export interface ClientPortalStage {
  id: number;
  name: string;
  order_num: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string; // pending | in_progress | done
}

export interface ClientPortalDeal {
  deal_id: number;
  deal_code: string;
  stage: string;
  budget: number;
  address: string | null;
  signed_date: string | null;
  client_token: string;
  project_id: number | null;
  client_name: string;
  client_phone: string;
  project_status: string | null;
  start_date: string | null;
  deadline: string | null;
  project_code: string | null;
}

export interface ClientPaymentHistoryItem {
  id: number;
  code: string;
  amount: number;
  category: string;
  payment_date: string;
  description: string;
}

export interface ClientPortalData {
  deal: ClientPortalDeal;
  stages: ClientPortalStage[];
  acts: ClientAct[];
  payments_history: ClientPaymentHistoryItem[];
  paid_main: number;
  paid_extra: number;
  balance: number;
  paid_pct: number;
  budget: number;
}

export interface GanttStage {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  order_num: number;
  stage_num: number | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string; // pending | in_progress | done
  progress_percent: number; // 0 | 25 | 50 | 75 | 100
  group_name: string | null;
  duration_days: number;
  deviation_days: number;
  deviation_label: string | null; // Опережение | Отставание | По плану | null
  children?: GanttStage[]; // только для групп (parent_id IS NULL)
}

// ─── Снабжение: Поставщики, Материалы, Счета, Заявки, План ───────────────────

export type SupplierCategory = 'бетон' | 'пиломатериалы' | 'металл' | 'кровля' | 'инженерия' | 'отделка' | 'прочее';
export type MaterialUnit = 'шт' | 'м3' | 'т' | 'пог.м' | 'м2' | 'компл';

export const SUPPLIER_CATEGORIES: SupplierCategory[] = ['бетон','пиломатериалы','металл','кровля','инженерия','отделка','прочее'];
export const MATERIAL_UNITS: MaterialUnit[] = ['шт','м3','т','пог.м','м2','компл'];

export interface Supplier {
  id: number;
  name: string;
  inn: string | null;
  category: SupplierCategory;
  contact: string | null;
  rating: number | null; // 1-5
  is_active: boolean;
  created_at: string;
}

export interface Material {
  id: number;
  name: string;
  unit: MaterialUnit;
  supplier_category: SupplierCategory | null;
  is_active: boolean;
  created_at: string;
}

export interface Invoice {
  id: number;
  supplier_id: number;
  supplier_name: string;
  material_id: number;
  material_name: string;
  unit: MaterialUnit;
  invoice_date: string | null;
  invoice_number: string | null;
  unit_price: number | null;
  quantity: number | null;
  total_amount: number | null;
  pdf_file_url: string | null;
  pdf_file_name: string | null;
  recognition_status: 'новый' | 'обработан' | 'требуется_проверка';
  recognized_data: string | null;
  created_at: string;
}

export interface PurchaseRequest {
  id: number;
  created_at: string;
  staff_id: number;
  staff_name: string;
  material_id: number;
  material_name: string;
  unit: MaterialUnit;
  supplier_category: SupplierCategory | null;
  quantity: number;
  needed_by: string | null;
  status: 'новая' | 'в_работе' | 'закрыта';
  suppliers: { id: number; name: string; category: string; rating: number | null }[];
}

export interface PurchasePlan {
  id: number;
  material_id: number;
  material_name: string;
  unit: MaterialUnit;
  planned_volume: number;
  period: 'неделя' | 'месяц';
  period_start: string;
  created_at: string;
}