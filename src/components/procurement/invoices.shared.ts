import { Invoice } from "@/lib/api";
import { Role } from "@/App";

export const AI_ROLES: Role[] = ["director", "supply_director", "supplier"];

export const ACCEPT_TYPES = ".jpg,.jpeg,.png,.pdf,.xls,.xlsx";
export const ACCEPT_HINT  = "JPG, PNG, PDF, Excel — счёт или накладная";

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

export const fmtMoney = (n: number | null | undefined) =>
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

// ── Сжатие изображения через Canvas ──────────────────────────────────────────
async function compressImageToJpeg(
  source: HTMLImageElement | HTMLCanvasElement,
  maxPx = 1400,
  quality = 0.80,
): Promise<string> {
  let w: number, h: number;
  if (source instanceof HTMLImageElement) {
    w = source.naturalWidth; h = source.naturalHeight;
  } else {
    w = source.width; h = source.height;
  }
  if (w > maxPx || h > maxPx) {
    const scale = maxPx / Math.max(w, h);
    w = Math.round(w * scale); h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

// ── PDF первая страница → JPG через pdf.js ────────────────────────────────────
export async function pdfToJpeg(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  // Используем встроенный воркер (fake worker без Web Worker)
  GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);

  // 150 dpi: viewport scale = 150/72 ≈ 2.08
  const viewport = page.getViewport({ scale: 150 / 72 });
  const canvas   = document.createElement("canvas");
  canvas.width   = Math.round(viewport.width);
  canvas.height  = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  pdf.destroy();

  return compressImageToJpeg(canvas, 1400, 0.80);
}

// ── Excel → JPG через SheetJS + Canvas ───────────────────────────────────────
export async function excelToJpeg(file: File): Promise<string> {
  const XLSX = await import("xlsx");

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

  // Убираем полностью пустые строки
  const clean = rows.filter(r => r.some(c => String(c).trim() !== ""));
  // Не более 120 строк (при 120 ≈ высота ~2400px, хватит для Gemini)
  const display = clean.slice(0, 120);
  const ncols = Math.max(...display.map(r => r.length), 1);

  // Параметры отрисовки
  const FONT_PX  = 13;
  const PAD      = 5;
  const ROW_H    = FONT_PX + PAD * 2 + 1;
  // Ширина колонок: первые 2 шире (номер/наименование), остальные по 110
  const colW = (ci: number) => ci === 0 ? 40 : ci === 1 ? 280 : 110;
  const totalW = Array.from({ length: ncols }, (_, i) => colW(i)).reduce((a, b) => a + b, 0);
  const totalH = display.length * ROW_H + 2;

  const canvas = document.createElement("canvas");
  canvas.width  = totalW + 2;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  // Фон
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${FONT_PX}px monospace`;
  ctx.textBaseline = "middle";

  display.forEach((row, ri) => {
    const y = ri * ROW_H;
    // Зебра
    ctx.fillStyle = ri % 2 === 0 ? "#f5f7fa" : "#ffffff";
    ctx.fillRect(0, y, canvas.width, ROW_H);

    // Разделитель строки
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, y + ROW_H - 1, canvas.width, 1);

    let x = 1;
    for (let ci = 0; ci < ncols; ci++) {
      const cw = colW(ci);
      const cell = String(row[ci] ?? "");
      // Клип для ячейки
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + PAD, y, cw - PAD * 2, ROW_H);
      ctx.clip();
      ctx.fillStyle = "#1a202c";
      ctx.fillText(cell, x + PAD, y + ROW_H / 2);
      ctx.restore();

      // Разделитель колонки
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(x + cw - 1, y, 1, ROW_H);
      x += cw;
    }
  });

  return compressImageToJpeg(canvas, 1400, 0.80);
}

export async function prepareFileForUpload(
  file: File,
  onProgress?: (stage: "converting" | "ready") => void,
): Promise<{ b64: string; name: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext);
  const isPdf   = ext === "pdf";
  const isExcel = ["xls", "xlsx"].includes(ext);

  // ── Изображения — сжимаем через Canvas ────────────────────────────────────
  if (isImage) {
    const b64 = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        compressImageToJpeg(img, 1400, 0.80).then(resolve).catch(reject);
      };
      img.onerror = reject;
      img.src = url;
    });
    const name = file.name.replace(/\.(png|webp|jpe?g)$/i, ".jpg");
    return { b64, name: name.endsWith(".jpg") ? name : name + ".jpg" };
  }

  // ── PDF → JPG на фронте через pdf.js ──────────────────────────────────────
  if (isPdf) {
    onProgress?.("converting");
    const b64 = await pdfToJpeg(file);
    onProgress?.("ready");
    const name = file.name.replace(/\.pdf$/i, ".jpg");
    return { b64, name };
  }

  // ── Excel → JPG на фронте через SheetJS + Canvas ──────────────────────────
  if (isExcel) {
    onProgress?.("converting");
    const b64 = await excelToJpeg(file);
    onProgress?.("ready");
    const name = file.name.replace(/\.xlsx?$/i, ".jpg");
    return { b64, name };
  }

  throw new Error(
    "Неподдерживаемый формат. Загрузите JPG, PNG, PDF или Excel (XLS/XLSX)."
  );
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

// Одна распознанная позиция из счёта
export interface AiItem {
  supplier_id: number | null;
  supplier_name?: string | null;   // только для отображения из бэкенда, не передаётся при создании
  supplier_created: boolean;
  material: string | null;
  material_id: number | null;
  material_created: boolean;
  unit: string;
  unit_price: number | null;
  quantity: number | null;
  invoice_date: string | null;
  invoice_number: string | null;
  complete: boolean;
  /** 'ok' | 'suspicious' (цена скорректирована) | 'bad' (нет цены/кол-ва) */
  quality?: "ok" | "suspicious" | "bad";
  price_fixed?: boolean;
}

// Пустая позиция для ручного ввода
export const EMPTY_AI_ITEM: AiItem = {
  supplier_id: null, supplier_created: false,
  material: null,    material_id: null, material_created: false,
  unit: "шт", unit_price: null, quantity: null,
  invoice_date: null, invoice_number: null, complete: false,
  quality: "ok", price_fixed: false,
};

// Шаблон таблицы
export interface TableTemplate {
  id: number;
  name: string;
  headers: string[];
  /** { material: 1, quantity: 3, unit_price: 4, unit: 2, ... } — 0-based индексы */
  column_map: Record<string, number | null>;
  ai_suggested: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string | null;
}

// Маппируемые поля и их метки
export const MAPPABLE_FIELDS: { key: string; label: string }[] = [
  { key: "material",   label: "Наименование" },
  { key: "quantity",   label: "Количество"   },
  { key: "unit_price", label: "Цена"         },
  { key: "unit",       label: "Ед. изм."     },
  { key: "total",      label: "Сумма"        },
  { key: "row_num",    label: "№ строки"     },
  { key: "skip",       label: "Пропустить"   },
];

// Полный ответ от бэкенда после AI-распознавания
export interface AiRecognizeResult {
  status: string;
  meta: { invoice_date: string | null; invoice_number: string | null };
  items: AiItem[];
  parse_error: string | null;
  fallback_used?: boolean;
  items_count?: number;
  footer_total?: number | null;
  // ── шаблонная информация ──
  template_used?: boolean;
  template?: { id: number | null; name: string | null; score: number | null };
  need_template_setup?: boolean;
  table_headers?: string[];
  ai_col_suggestion?: Record<string, number | null>;
  /** Заполняется при автооткате шаблона: что за шаблон не справился */
  template_fallback_info?: { id: number; name: string; complete_ratio: number } | null;
  debug: {
    raw_response: string | null;
    raw_response_2?: string | null;
    parse_error: string | null;
    fallback_used?: boolean;
    items_debug: string[];
    continuation_log?: string[];
  };
}

export interface UploadedFile {
  url: string;
  name: string;
}