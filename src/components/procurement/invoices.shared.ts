import { Invoice } from "@/lib/api";
import { Role } from "@/App";

export const AI_ROLES: Role[] = ["director", "supply_director", "supplier"];

export const ACCEPT_TYPES = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.docx";
export const ACCEPT_HINT  = "PDF, JPG/PNG, Excel, Word";

export const EXT_ICON: Record<string, string> = {
  pdf: "FileText", jpg: "Image", jpeg: "Image", png: "Image",
  xls: "Table", xlsx: "Table", docx: "FileType2",
};

export const STATUS_CFG: Record<
  Invoice["recognition_status"],
  { label: string; cls: string; icon: string }
> = {
  новый:              { label: "Новый",            cls: "bg-amber-100 text-amber-700",     icon: "Clock" },
  обработан:          { label: "Обработан",        cls: "bg-emerald-100 text-emerald-700", icon: "CheckCircle" },
  требуется_проверка: { label: "Требует проверки", cls: "bg-red-100 text-red-700",         icon: "AlertCircle" },
};

export const fmtMoney = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ru-RU") : "—";

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface InvoiceForm {
  supplier_id: string;
  material_id: string;
  invoice_date: string;
  invoice_number: string;
  unit_price: string;
  quantity: string;
  recognition_status: Invoice["recognition_status"];
  recognized_data: string;
}

export const EMPTY_FORM: InvoiceForm = {
  supplier_id: "", material_id: "", invoice_date: "", invoice_number: "",
  unit_price: "", quantity: "",
  recognition_status: "новый",
  recognized_data: "",
};

export interface ApplyData {
  supplier_id: string;
  material_id: string;
  unit_price: string;
  quantity: string;
  invoice_date: string;
  invoice_number: string;
  recognized_data: string;
  recognition_status: Invoice["recognition_status"];
}

export interface UploadedFile {
  url: string;
  name: string;
}

// Полный ответ от бэкенда после AI-распознавания
export interface AiRecognizeResult {
  status: string;
  parsed: Record<string, unknown>;
  supplier_id: number | null;
  supplier_created: boolean;
  material_id: number | null;
  material_created: boolean;
  debug: {
    raw_response: string | null;
    parse_error: string | null;
    supplier_action: string | null;
    material_action: string | null;
  };
}