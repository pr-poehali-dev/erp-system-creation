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

// ── Распознавание счетов ───────────────────────────────────────────────────
// Excel  → SheetJS → TSV → DeepSeek API напрямую из браузера (без Cloud Function)
// JPG / PNG / PDF → Gemini через chatgpt-polza Cloud Function
const POLZA_URL    = "https://functions.poehali.dev/778ceb38-0039-4da4-9a48-0cb34a7527cf";
const DS_API_URL   = "https://api.deepseek.com/v1/chat/completions";
const DS_API_KEY   = "sk-bd65a737066e44649654f6d16983950d";
const DS_MODEL     = "deepseek-chat";
const DS_CHUNK     = 20; // строк на один запрос

const _RECOGNIZE_PROMPT = `Ты — ассистент для извлечения данных из счетов. Перед тобой изображение таблицы.

ВАЖНО: Игнорируй все фотографии товаров, логотипы, баннеры, QR-коды, штрих-коды, иконки и любую другую графику.
Читай ТОЛЬКО текст таблицы и реквизиты документа.

Извлеки ВСЕ позиции. Для каждой:
- material: полное название (не сокращай, включая размеры и артикулы)
- quantity: число (может быть дробным)
- unit: единица измерения (м3, шт, м, пог.м, м2 и т.д.)
- unit_price: цена за единицу
- amount: сумма строки

Найди supplier_name, invoice_date (YYYY-MM-DD), invoice_number в шапке документа.

ПРАВИЛА:
1. Строки-заголовки (№, Наименование, Кол-во...) — пропускай.
2. Если значение отсутствует — ставь null.
3. Числа — только цифры без пробелов и символов валюты.
4. Не добавляй комментариев.

Верни только JSON без markdown-обёрток:
{"supplier_name":"...","invoice_date":"YYYY-MM-DD","invoice_number":"...","footer_total":число,"items":[{"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число}]}`;

// ── Excel → TSV-чанки через SheetJS ──────────────────────────────────────────
async function _excelToTsvChunks(file_b64: string): Promise<{ chunks: string[] }> {
  const XLSX = await import("xlsx");
  const binary = atob(file_b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const wb   = XLSX.read(bytes, { type: "array" });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][])
    .filter(r => r.some(c => String(c).trim() !== ""));

  if (!rows.length) throw new Error("Excel пустой или не содержит данных");

  // Первые 5 строк — шапка с реквизитами (поставщик, дата, номер)
  const headerRows = rows.slice(0, 5);
  const dataRows   = rows.slice(5);
  const headerTsv  = headerRows.map(r => r.join("\t"));

  const chunks: string[] = [];
  if (!dataRows.length) {
    chunks.push(rows.map(r => r.join("\t")).join("\n"));
  } else {
    for (let i = 0; i < dataRows.length; i += DS_CHUNK) {
      const slice = dataRows.slice(i, i + DS_CHUNK);
      chunks.push([...headerTsv, ...slice.map(r => r.join("\t"))].join("\n"));
    }
  }
  return { chunks };
}

// ── Один запрос к DeepSeek API с авто-ретраем ────────────────────────────────
async function _callDeepSeek(tsvChunk: string, attempt = 1): Promise<Record<string, unknown>> {
  const prompt =
    `Извлеки ВСЕ позиции из фрагмента счёта в формате TSV.\n` +
    `Для каждой: material (полное название), quantity (число), unit (строка), unit_price (число).\n` +
    `Поставщика, дату и номер счёта ищи в начале.\n` +
    `Верни СТРОГО JSON без markdown-обёрток:\n` +
    `{ "supplier_name":"...", "invoice_date":"YYYY-MM-DD", "invoice_number":"...", "footer_total":число, "items":[ {"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число} ] }\n` +
    `Не пропускай строки, не добавляй комментариев.\n\n${tsvChunk}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const resp = await fetch(DS_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DS_API_KEY}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: DS_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`DeepSeek ${resp.status}: ${t.slice(0, 200)}`);
    }

    const data    = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("DeepSeek вернул пустой ответ");

    // Парсим JSON из ответа
    const clean = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    try { return JSON.parse(clean); } catch { /* fallback */ }
    const m = [...clean.matchAll(/\{[\s\S]+\}/g)].sort((a, b) => b[0].length - a[0].length);
    for (const match of m) {
      try { return JSON.parse(match[0]); } catch { /* continue */ }
    }
    throw new Error(`Не удалось разобрать JSON из ответа: ${content.slice(0, 200)}`);
  } finally {
    clearTimeout(timer);
  }
}

// Ретрай-обёртка
async function _callDeepSeekWithRetry(tsvChunk: string): Promise<Record<string, unknown>> {
  try {
    return await _callDeepSeek(tsvChunk);
  } catch {
    await new Promise(r => setTimeout(r, 2000));
    return await _callDeepSeek(tsvChunk);
  }
}

// ── Объединение результатов нескольких чанков ─────────────────────────────────
function _mergeDeepSeekChunks(results: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    supplier_name: null, invoice_date: null, invoice_number: null, footer_total: null, items: [],
  };
  for (const r of results) {
    if (!merged.supplier_name  && r.supplier_name)  merged.supplier_name  = r.supplier_name;
    if (!merged.invoice_date   && r.invoice_date)   merged.invoice_date   = r.invoice_date;
    if (!merged.invoice_number && r.invoice_number) merged.invoice_number = r.invoice_number;
    if (r.footer_total != null)                     merged.footer_total   = r.footer_total;
    if (Array.isArray(r.items)) (merged.items as unknown[]).push(...r.items);
  }
  return merged;
}

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

// ── PDF → JPEG через pdfjs-dist (первая страница) ────────────────────────────
// Используется как fallback для PDF с QR, сложной вёрсткой или при пустом ответе.
async function _pdfToJpeg(pdfB64: string, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.("Рендеринг PDF в изображение...");

  // Динамический импорт pdfjs
  const pdfjsLib = await import("pdfjs-dist");

  // Указываем worker через CDN чтобы не тащить в бандл
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }

  const binary = atob(pdfB64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pdf  = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);

  // Масштаб: приводим страницу к ~1400px по ширине
  const viewport0 = page.getViewport({ scale: 1 });
  const scale     = Math.min(1400 / viewport0.width, 2.5); // не больше 2.5x
  const viewport  = page.getViewport({ scale });

  const canvas  = document.createElement("canvas");
  canvas.width  = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
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

  // Масштабируем до максимума 1400px — оптимально для Gemini
  const MAX = 1400;
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
// Сжимаем PNG до maxW px и конвертируем в JPEG quality=0.85 для ускорения передачи
async function _resizeToJpeg(pngB64: string, maxW = 1400, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.src = `data:image/png;base64,${pngB64}`;
  });
}

async function _callPolza(imagePngB64: string, prompt: string): Promise<string> {
  // Сжимаем до 1400px JPEG quality 0.7 — ускоряет ответ и снижает риск таймаута
  const jpegB64 = await _resizeToJpeg(imagePngB64, 1400, 0.7);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // 120 сек

  try {
    const resp = await fetch(`${POLZA_URL}?action=generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpegB64}` } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      // 504 = таймаут Cloud Function — понятное сообщение
      if (resp.status === 504) {
        throw new Error("Счёт содержит сложные элементы. Попробуйте преобразовать его в JPG и загрузить снова.");
      }
      throw new Error(`Polza ${resp.status}: ${t.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// Признаки сложного PDF: QR/баркод в имени, или большой размер (>800KB base64 ≈ >600KB файл)
function _isPdfComplex(file_b64: string, file_name: string): boolean {
  const name = file_name.toLowerCase();
  if (/qr|barcode|штрих|scan|scan|сканир/i.test(name)) return true;
  // base64 длина: каждые 4 символа = 3 байта → > ~800KB файл
  return file_b64.length > 1_066_000;
}

// Отправить PDF напрямую как application/pdf (для простых PDF < ~600KB без QR)
async function _callPolzaPdf(pdfB64: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const resp = await fetch(`${POLZA_URL}?action=generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        temperature: 0,
        max_tokens: 8192,
        messages: [
          { role: "system", content: "Ты — система извлечения данных из счетов. Отвечай ТОЛЬКО строгим JSON." },
          { role: "user", content: [
            { type: "text",      text: _RECOGNIZE_PROMPT },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfB64}` } },
          ]},
        ],
      }),
    });
    if (!resp.ok) {
      if (resp.status === 504) throw new Error("__504__");
      const t = await resp.text();
      throw new Error(`Polza ${resp.status}: ${t.slice(0, 200)}`);
    }
    return (await resp.json()).content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Распознаёт Excel / PDF / JPG / PNG напрямую через Polza.ai из браузера.
 *
 * Логика:
 * - Excel  → SheetJS → Canvas PNG → JPEG 1400px → Gemini
 * - PDF простой (<600KB, без QR) → data:application/pdf → Gemini
 *   При пустом ответе/ошибке — автоматически fallback через pdfjs рендер
 * - PDF сложный (>600KB или QR в имени) → pdfjs рендер → JPEG → Gemini сразу
 * - JPG/PNG → JPEG 1400px → Gemini
 */
export async function recognizeViaPolza(
  file_b64: string,
  file_name: string,
  onProgress?: (msg: string) => void,
): Promise<{ success: boolean; ai_obj: Record<string, unknown>; items: unknown[]; raw: string; error?: string }> {
  const ext     = file_name.split(".").pop()?.toLowerCase() ?? "";
  const isExcel = ["xls", "xlsx"].includes(ext);
  const isPdf   = ext === "pdf";

  onProgress?.("Распознавание через ИИ... может занять до 60 секунд");

  try {
    // ── Excel → SheetJS → TSV → DeepSeek API (прямо из браузера) ────────────
    if (isExcel) {
      onProgress?.("Читаем Excel...");
      const { chunks } = await _excelToTsvChunks(file_b64);

      const total   = chunks.length;
      const results: Record<string, unknown>[] = [];
      const errors:  string[] = [];

      for (let i = 0; i < total; i++) {
        onProgress?.(
          total > 1
            ? `DeepSeek анализирует... ${i + 1} из ${total} частей`
            : "DeepSeek анализирует таблицу..."
        );
        try {
          const r = await _callDeepSeekWithRetry(chunks[i]);
          results.push(r);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (!results.length) {
        return { success: false, ai_obj: {}, items: [], raw: "",
          error: `DeepSeek не ответил: ${errors.join("; ")}` };
      }

      const merged = _mergeDeepSeekChunks(results);
      const items  = Array.isArray(merged.items) ? merged.items as unknown[] : [];

      if (!items.length)
        return { success: false, ai_obj: merged, items: [], raw: JSON.stringify(merged),
          error: "DeepSeek не нашёл позиций в таблице. Проверьте формат файла." };

      return { success: true, ai_obj: merged, items, raw: JSON.stringify(merged) };
    }

    // ── PDF ────────────────────────────────────────────────────────────────────
    if (isPdf) {
      const complex = _isPdfComplex(file_b64, file_name);

      // Сразу идём по JPG-ветке если PDF сложный
      if (!complex) {
        onProgress?.("Анализ PDF...");
        try {
          const raw = await _callPolzaPdf(file_b64);
          if (raw.trim()) {
            const { ai_obj, items } = _parseAiJson(raw);
            if (items.length) return { success: true, ai_obj, items, raw };
          }
        } catch (e) {
          // 504 или пустой ответ — идём на fallback через рендер
          if (!(e instanceof Error && (e.message === "__504__" || e.message.includes("504")))) {
            throw e; // другая ошибка — пробрасываем
          }
        }
        // Простой PDF не дал результата — пробуем через рендер страницы
        onProgress?.("PDF не распознан напрямую, рендерим постранично...");
      } else {
        onProgress?.("Сложный PDF — рендеринг в изображение...");
      }

      const jpegB64 = await _pdfToJpeg(file_b64, onProgress);
      onProgress?.("Распознавание через ИИ... может занять до 60 секунд");
      const raw2 = await _callPolza(jpegB64, _RECOGNIZE_PROMPT);
      if (!raw2.trim())
        return { success: false, ai_obj: {}, items: [], raw: raw2,
          error: "PDF не поддаётся распознаванию. Попробуйте сохранить как JPG и загрузить снова." };
      const { ai_obj, items } = _parseAiJson(raw2);
      if (!items.length)
        return { success: false, ai_obj: {}, items: [], raw: raw2,
          error: `Позиции не найдены. Ответ модели: ${raw2.slice(0, 300)}` };
      return { success: true, ai_obj, items, raw: raw2 };
    }

    // ── JPG / PNG ──────────────────────────────────────────────────────────────
    const raw = await _callPolza(file_b64, _RECOGNIZE_PROMPT);
    if (!raw.trim())
      return { success: false, ai_obj: {}, items: [], raw, error: "Пустой ответ от модели. Попробуйте снова." };
    const { ai_obj, items } = _parseAiJson(raw);
    if (!items.length)
      return { success: false, ai_obj: {}, items: [], raw,
        error: `Модель не извлекла позиции. Ответ: ${raw.slice(0, 300)}` };
    return { success: true, ai_obj, items, raw };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 504 с понятным текстом
    const userMsg = msg.includes("504") || msg === "__504__"
      ? "Счёт содержит слишком много графики. Пожалуйста, сохраните его как JPG без картинок и загрузите снова."
      : msg;
    return { success: false, ai_obj: {}, items: [], raw: "", error: userMsg };
  }
}