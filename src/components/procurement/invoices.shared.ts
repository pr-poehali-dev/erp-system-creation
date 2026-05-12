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
async function compressImageToJpeg(img: HTMLImageElement, maxPx = 1400, quality = 0.80): Promise<string> {
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > maxPx || h > maxPx) {
    const scale = maxPx / Math.max(w, h);
    w = Math.round(w * scale); h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

// Читаем файл в base64
async function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
      img.onload = () => { URL.revokeObjectURL(url); compressImageToJpeg(img, 1400, 0.80).then(resolve).catch(reject); };
      img.onerror = reject;
      img.src = url;
    });
    const name = file.name.replace(/\.(png|webp|jpe?g)$/i, ".jpg");
    return { b64, name: name.endsWith(".jpg") ? name : name + ".jpg" };
  }

  // ── PDF и Excel — передаём байты на бэкенд, он конвертирует в JPG ──────────
  if (isPdf || isExcel) {
    onProgress?.("converting");
    const b64 = await fileToB64(file);
    onProgress?.("ready");
    return { b64, name: file.name };
  }

  throw new Error("Неподдерживаемый формат. Загрузите JPG, PNG, PDF или Excel (XLS/XLSX).");
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

// ── Прямое распознавание файла через Polza.ai (без Cloud Function) ──────────
// Excel → SheetJS → Canvas PNG → Gemini. PDF → data:application/pdf → Gemini.
const POLZA_URL = "https://functions.poehali.dev/778ceb38-0039-4da4-9a48-0cb34a7527cf";

const _RECOGNIZE_PROMPT = `Ты — ассистент для извлечения данных из счетов. Перед тобой изображение таблицы счёта.
Извлеки ВСЕ позиции без исключений.

Для каждой позиции верни:
- material: полное название (не сокращай, включая размеры и артикулы)
- quantity: число (может быть дробным)
- unit: единица измерения (м3, шт, м, пог.м, м2 и т.д.)
- unit_price: цена за единицу
- amount: сумма строки

Поставщика, дату и номер счёта ищи в начале документа (шапке).

ПРАВИЛА:
1. Строки-заголовки (№, Наименование, Кол-во...) — пропускай.
2. Если значение отсутствует — ставь null.
3. Числа — только цифры без пробелов и символов валюты.
4. Не добавляй комментариев.

Верни строго JSON без markdown-обёрток:
{"supplier_name":"...","invoice_date":"YYYY-MM-DD","invoice_number":"...","footer_total":число,"items":[{"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число}]}`;

// ── Парсер JSON-ответа ────────────────────────────────────────────────────────
function _parseAiJson(raw: string): { ai_obj: Record<string, unknown>; items: unknown[] } {
  const s = raw.trim().replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  try {
    const p = JSON.parse(s);
    if (typeof p === "object" && p && "items" in p)
      return { ai_obj: p as Record<string, unknown>, items: (p as Record<string, unknown[]>).items as unknown[] };
  } catch { /* fallback */ }
  const matches = [...s.matchAll(/\{[\s\S]+\}/g)].sort((a, b) => b[0].length - a[0].length);
  for (const m of matches) {
    try {
      const p = JSON.parse(m[0]);
      if (typeof p === "object" && p && "items" in p)
        return { ai_obj: p as Record<string, unknown>, items: (p as Record<string, unknown[]>).items as unknown[] };
    } catch { /* continue */ }
  }
  return { ai_obj: {}, items: [] };
}

// ── Excel → PNG через SheetJS + Canvas (без сторонних зависимостей) ──────────
async function _excelToPngB64(file_b64: string): Promise<string> {
  const XLSX = await import("xlsx");

  // Декодируем base64 → Uint8Array
  const binary = atob(file_b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const wb = XLSX.read(bytes, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

  // Убираем полностью пустые строки
  const data = rows.filter(r => r.some(c => String(c).trim() !== ""));
  if (!data.length) throw new Error("Excel пустой");

  const ncols = Math.max(...data.map(r => r.length), 1);
  const filled = data.map(r => [...r, ...Array(ncols - r.length).fill("")]);

  // Параметры рендера
  const FONT  = 13;
  const PAD   = 6;
  const ROW_H = FONT + PAD * 2;

  // Ширины колонок по содержимому (символ ≈ 7.5px, минимум 40, максимум 300)
  const colW = Array.from({ length: ncols }, (_, ci) => {
    const max = Math.max(...filled.map(r => String(r[ci] ?? "").length), 0);
    return Math.min(300, Math.max(ci === 0 ? 40 : ci === 1 ? 200 : 90, max * 7.5 + PAD * 2));
  });

  const W = colW.reduce((a, b) => a + b, 0) + 2;
  const H = filled.length * ROW_H + 2;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.font = `${FONT}px monospace`;
  ctx.textBaseline = "middle";

  filled.forEach((row, ri) => {
    const y = ri * ROW_H;
    ctx.fillStyle = ri % 2 === 0 ? "#f0f4f8" : "#ffffff";
    ctx.fillRect(0, y, W, ROW_H);

    let x = 1;
    row.forEach((cell, ci) => {
      const cw = colW[ci];
      const maxChars = Math.floor((cw - PAD * 2) / 7.5);
      const text = String(cell).slice(0, maxChars + 1).length > maxChars
        ? String(cell).slice(0, maxChars - 1) + "…"
        : String(cell);

      ctx.fillStyle = "#111827";
      ctx.fillText(text, x + PAD, y + ROW_H / 2);

      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x + cw - 1, y, 1, ROW_H);   // вертикальный разделитель
      x += cw;
    });

    ctx.fillStyle = "#d1d5db";
    ctx.fillRect(0, y + ROW_H - 1, W, 1);   // горизонтальный разделитель
  });

  // Масштабируем до максимума 2400px (Gemini хорошо читает крупные изображения)
  const MAX = 2400;
  if (W > MAX || H > MAX) {
    const scale = MAX / Math.max(W, H);
    const c2 = document.createElement("canvas");
    c2.width  = Math.round(W * scale);
    c2.height = Math.round(H * scale);
    c2.getContext("2d")!.drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2.toDataURL("image/png").split(",")[1];
  }
  return canvas.toDataURL("image/png").split(",")[1];
}

// ── Отправить один запрос в Polza.ai ─────────────────────────────────────────
async function _callPolza(imagePngB64: string, prompt: string): Promise<string> {
  const resp = await fetch(`${POLZA_URL}?action=generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      temperature: 0,
      max_tokens: 8192,
      messages: [
        {
          role: "system",
          content: "Ты — система извлечения данных из счетов. Отвечай ТОЛЬКО строгим JSON без пояснений и markdown-обёрток.",
        },
        {
          role: "user",
          content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imagePngB64}` } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Polza ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.content ?? "";
}

/**
 * Распознаёт Excel или PDF напрямую через Polza.ai из браузера (без Cloud Function).
 * Excel конвертируется в PNG через SheetJS + Canvas.
 * PDF передаётся как data:application/pdf.
 */
export async function recognizeViaPolza(
  file_b64: string,
  file_name: string,
  onProgress?: (msg: string) => void,
): Promise<{ success: boolean; ai_obj: Record<string, unknown>; items: unknown[]; raw: string; error?: string }> {
  const ext     = file_name.split(".").pop()?.toLowerCase() ?? "";
  const isExcel = ["xls", "xlsx"].includes(ext);

  onProgress?.("Распознавание через ИИ... может занять до 60 секунд");

  try {
    let imagePngB64: string;

    if (isExcel) {
      onProgress?.("Преобразование Excel в изображение...");
      imagePngB64 = await _excelToPngB64(file_b64);
      onProgress?.("Распознавание через ИИ... может занять до 60 секунд");
    } else {
      // PDF / JPG / PNG — для PDF Gemini принимает application/pdf через image_url
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      };
      const mime = mimeMap[ext] ?? "image/jpeg";
      // Для PDF используем специальный путь — не PNG, а оригинал
      if (ext === "pdf") {
        const resp = await fetch(`${POLZA_URL}?action=generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-lite",
            temperature: 0,
            max_tokens: 8192,
            messages: [
              { role: "system", content: "Ты — система извлечения данных из счетов. Отвечай ТОЛЬКО строгим JSON." },
              { role: "user",   content: [
                  { type: "text",      text: _RECOGNIZE_PROMPT },
                  { type: "image_url", image_url: { url: `data:${mime};base64,${file_b64}` } },
              ]},
            ],
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          return { success: false, ai_obj: {}, items: [], raw: t, error: `Polza ${resp.status}: ${t.slice(0, 200)}` };
        }
        const raw = (await resp.json()).content ?? "";
        if (!raw.trim()) return { success: false, ai_obj: {}, items: [], raw, error: "Пустой ответ. Попробуйте снова." };
        const { ai_obj, items } = _parseAiJson(raw);
        return { success: true, ai_obj, items, raw };
      }
      // JPG/PNG — конвертируем в PNG canvas (сжатие/нормализация)
      imagePngB64 = file_b64;
    }

    const raw = await _callPolza(imagePngB64, _RECOGNIZE_PROMPT);

    if (!raw.trim())
      return { success: false, ai_obj: {}, items: [], raw, error: "Пустой ответ от модели. Попробуйте снова." };

    const { ai_obj, items } = _parseAiJson(raw);
    if (!items.length)
      return { success: false, ai_obj: {}, items: [], raw, error: `Модель не извлекла позиции. Ответ: ${raw.slice(0, 300)}` };

    return { success: true, ai_obj, items, raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, ai_obj: {}, items: [], raw: "", error: msg };
  }
}