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

// ── Вызов DeepSeek API (текст) ────────────────────────────────────────────────
// Кастомная ошибка с HTTP-статусом для диагностики
class DeepSeekError extends Error {
  constructor(public readonly status: number | null, public readonly body: string) {
    super(`DeepSeek ${status ?? "network"}: ${body.slice(0, 300)}`);
  }
}

async function _callDeepSeekRaw(userContent: string, maxTokens = 16384): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    let resp: Response;
    try {
      resp = await fetch(DS_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DS_API_KEY}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: DS_MODEL,
          messages: [{ role: "user", content: userContent }],
          temperature: 0,
          max_tokens: maxTokens,
        }),
      });
    } catch (netErr) {
      // Сетевая ошибка (таймаут, CORS, offline)
      const msg = netErr instanceof Error ? netErr.message : String(netErr);
      throw new DeepSeekError(null, msg);
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => resp.statusText);
      throw new DeepSeekError(resp.status, t);
    }
    const data    = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new DeepSeekError(resp.status, "пустой ответ от модели");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// Парсим JSON из ответа DeepSeek (убираем markdown, ищем объект с items)
function _parseDeepSeekJson(content: string): Record<string, unknown> {
  const clean = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  try { return JSON.parse(clean); } catch { /* fallback */ }
  const matches = [...clean.matchAll(/\{[\s\S]+\}/g)].sort((a, b) => b[0].length - a[0].length);
  for (const m of matches) {
    try { return JSON.parse(m[0]); } catch { /* continue */ }
  }
  throw new Error(`Не удалось разобрать JSON: ${content.slice(0, 200)}`);
}

// Ретрай-обёртка:
// - Сначала пробуем с max_tokens=16384
// - Если JSON оборван (parse error) — повтор через 2 сек с теми же 16384
// - Если сетевая/другая ошибка — повтор через 2 сек
async function _callDeepSeekWithRetry(content: string): Promise<Record<string, unknown>> {
  const run = async () => _parseDeepSeekJson(await _callDeepSeekRaw(content, 16384));
  try {
    return await run();
  } catch (e) {
    // Любая ошибка (обрыв JSON или сеть) — пауза и повтор
    await new Promise(r => setTimeout(r, 2000));
    return await run();
  }
}

// ── Excel → подготовленные TSV-чанки через SheetJS ───────────────────────────
// ≤100 строк: один запрос (без чанков, без дублей)
// >100 строк: чанки по 100 + только шапка (без списка всех материалов)
const DS_CHUNK_LARGE = 100;

async function _excelToTsvChunks(file_b64: string): Promise<{ chunks: string[] }> {
  const XLSX = await import("xlsx");
  const binary = atob(file_b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const wb = XLSX.read(bytes, { type: "array", dense: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  let rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][]);

  // Убираем полностью пустые строки и обрезаем пустые правые столбцы
  rows = rows
    .filter(r => r.some(c => String(c).trim() !== ""))
    .map(r => {
      let last = r.length - 1;
      while (last > 0 && String(r[last] ?? "").trim() === "") last--;
      return r.slice(0, last + 1);
    });

  if (!rows.length) throw new Error("Excel пустой или не содержит данных");

  // Шапка (первые 5 строк — реквизиты: поставщик, дата, номер)
  const headerRows = rows.slice(0, 5);
  let   dataRows   = rows.slice(5);

  // Убираем строки без числовых данных (заголовки столбцов, разделители и т.п.)
  const _hasNumber = (r: string[]) => r.some(c => /\d/.test(String(c)));
  dataRows = dataRows.filter(r => _hasNumber(r) || r.some(c => String(c).trim().length > 3));

  // Проверяем размер
  const allRows    = [...headerRows, ...dataRows];
  const tsvSample  = allRows.slice(0, 50).map(r => r.join("\t")).join("\n");
  const avgRowSize = tsvSample.length / Math.min(allRows.length, 50);
  const estTsvSize = avgRowSize * allRows.length;
  if (estTsvSize > 1_000_000) {
    throw new Error(
      `Файл слишком большой (~${allRows.length} строк).\n` +
      `Сделайте скриншот таблицы в JPG и загрузите его — JPG обрабатывается через Gemini без ограничений.`
    );
  }

  const headerTsv = headerRows.map(r => r.join("\t"));
  const chunks: string[] = [];

  if (dataRows.length <= DS_CHUNK_LARGE) {
    // ≤100 строк — один запрос, без чанков
    chunks.push(allRows.map(r => r.join("\t")).join("\n"));
  } else {
    // >100 строк — чанки по 100, только шапка без списка материалов
    for (let i = 0; i < dataRows.length; i += DS_CHUNK_LARGE) {
      const slice = dataRows.slice(i, i + DS_CHUNK_LARGE);
      chunks.push([...headerTsv, ...slice.map(r => r.join("\t"))].join("\n"));
    }
  }
  return { chunks };
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

  // Масштаб: 150 dpi ≈ scale 2.08 для A4, max 1600px по ширине
  const viewport0 = page.getViewport({ scale: 1 });
  const scale     = Math.min(1600 / viewport0.width, 150 / 72); // 150 dpi
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

// ── Сжатие изображения для Gemini ────────────────────────────────────────────
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

async function _callPolzaWithModel(
  imagePngB64: string,
  prompt: string,
  model: string,
  maxTokens = 16384,
): Promise<string> {
  const jpegB64 = await _resizeToJpeg(imagePngB64, 1400, 0.7);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 190_000);
  try {
    const resp = await fetch(`${POLZA_URL}?action=generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
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
      if (resp.status === 504) throw new Error("__504__");
      throw new Error(`Polza ${resp.status}: ${t.slice(0, 200)}`);
    }
    return (await resp.json()).content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// JPG/PNG — Gemini (стабильная модель для изображений)
async function _callPolza(imagePngB64: string, prompt: string): Promise<string> {
  return _callPolzaWithModel(imagePngB64, prompt, "google/gemini-3.1-flash-lite");
}



// ── PDF → DeepSeek через text extraction ─────────────────────────────────────
// DeepSeek не поддерживает изображения, поэтому передаём PDF как base64 в промпт.
// DeepSeek умеет работать с base64-encoded PDF в текстовом сообщении.
const _PDF_DEEPSEEK_PROMPT =
  `Ты — ассистент для извлечения данных из счетов.\n` +
  `Тебе передан PDF-файл в base64. Извлеки ВСЕ позиции счёта.\n` +
  `Игнорируй QR-коды, логотипы, штрих-коды, изображения товаров и любую графику.\n` +
  `Читай ТОЛЬКО текст: таблицу позиций и реквизиты в шапке.\n\n` +
  `Для каждой позиции: material (полное название, не сокращай), quantity (число), unit (строка), unit_price (число).\n` +
  `Найди: supplier_name, invoice_date (YYYY-MM-DD), invoice_number.\n\n` +
  `ПРАВИЛА:\n` +
  `1. Строки-заголовки (№, Наименование, Кол-во...) — пропускай.\n` +
  `2. Если значение отсутствует — ставь null.\n` +
  `3. Числа без пробелов и символов валюты.\n` +
  `4. Верни ТОЛЬКО JSON без markdown:\n` +
  `{"supplier_name":"...","invoice_date":"YYYY-MM-DD","invoice_number":"...","footer_total":число,"items":[{"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число}]}`;

async function _callDeepSeekPdf(pdfB64: string): Promise<Record<string, unknown>> {
  const content = `${_PDF_DEEPSEEK_PROMPT}\n\nPDF (base64):\n${pdfB64}`;
  const run = async () => _parseDeepSeekJson(await _callDeepSeekRaw(content, 16384));
  // Попытка 1
  try {
    return await run();
  } catch (e1) {
    console.warn("[PDF] DeepSeek попытка 1 провалилась:", e1 instanceof Error ? e1.message : e1);
  }
  // Попытка 2 (через 2 сек, пробрасываем ошибку наружу для диагностики)
  await new Promise(r => setTimeout(r, 2000));
  return await run(); // бросает DeepSeekError если снова ошибка
}

/**
 * Распознаёт счёт из браузера:
 * - Excel (.xls/.xlsx) → SheetJS → TSV чанки → DeepSeek (текст, без таймаутов CF)
 * - PDF              → base64 → DeepSeek (читает текст, игнорирует QR/графику)
 * - JPG / PNG        → JPEG 1400px → Gemini через Polza Cloud Function
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
    // ── Excel → TSV → DeepSeek (прямо из браузера, без таймаута CF) ──────────
    if (isExcel) {
      onProgress?.("Читаем Excel...");
      const { chunks } = await _excelToTsvChunks(file_b64);

      const total   = chunks.length;
      const results: Record<string, unknown>[] = [];
      const errors:  string[] = [];

      for (let i = 0; i < total; i++) {
        onProgress?.(
          total > 1
            ? `DeepSeek анализирует... часть ${i + 1} из ${total}`
            : "DeepSeek анализирует таблицу..."
        );
        const userContent =
          `Извлеки ВСЕ позиции из счёта в формате TSV. Каждую строку данных обрабатывай ровно один раз — без дублей.\n` +
          `Для каждой позиции: material (полное название, не сокращай), quantity (число), unit (строка), unit_price (число).\n` +
          `Поставщика, дату и номер счёта ищи в шапке (первые строки).\n` +
          `Строки-заголовки таблицы (№, Наименование, Кол-во...) — пропускай.\n` +
          `Верни СТРОГО JSON без markdown:\n` +
          `{"supplier_name":"...","invoice_date":"YYYY-MM-DD","invoice_number":"...","footer_total":число,"items":[{"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число}]}\n\n` +
          `Данные (TSV):\n${chunks[i]}`;

        try {
          const r = await _callDeepSeekWithRetry(userContent);
          results.push(r);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (!results.length)
        return { success: false, ai_obj: {}, items: [], raw: "",
          error: `DeepSeek не ответил: ${errors.join("; ")}` };

      const merged = _mergeDeepSeekChunks(results);
      const items  = Array.isArray(merged.items) ? merged.items as unknown[] : [];

      if (!items.length)
        return { success: false, ai_obj: merged, items: [], raw: JSON.stringify(merged),
          error: "DeepSeek не нашёл позиций в таблице. Проверьте формат файла." };

      return { success: true, ai_obj: merged, items, raw: JSON.stringify(merged) };
    }

    // ── PDF → pdfjs → JPG → Попытка 1: Qwen3.5 Plus / Попытка 2: Gemini ─────
    if (isPdf) {
      onProgress?.("Рендеринг PDF в изображение...");
      const jpegB64 = await _pdfToJpeg(file_b64, onProgress);

      // Попытка 1: GPT-5.5
      onProgress?.("GPT-5.5 анализирует PDF...");
      let gpt55Error = "";
      try {
        const raw1 = await _callPolzaWithModel(jpegB64, _RECOGNIZE_PROMPT, "openai/gpt-5.5");
        if (raw1.trim()) {
          const { ai_obj, items } = _parseAiJson(raw1);
          if (items.length) {
            console.info("[PDF] gpt-5.5 успешно:", items.length, "позиций");
            return { success: true, ai_obj, items, raw: raw1 };
          }
        }
        gpt55Error = "gpt-5.5 вернул пустой ответ";
        console.warn("[PDF]", gpt55Error);
      } catch (e1) {
        gpt55Error = e1 instanceof Error ? e1.message : String(e1);
        console.warn("[PDF] gpt-5.5 ошибка:", gpt55Error);
      }
      onProgress?.(`gpt-5.5: ${gpt55Error.slice(0, 80)} → Gemini fallback...`);

      // Попытка 2: Gemini fallback
      try {
        const raw2 = await _callPolzaWithModel(jpegB64, _RECOGNIZE_PROMPT, "google/gemini-3.1-flash-lite");
        if (raw2.trim()) {
          const { ai_obj, items } = _parseAiJson(raw2);
          if (items.length) {
            console.info("[PDF] Gemini fallback успешно:", items.length, "позиций");
            return { success: true, ai_obj, items, raw: raw2 };
          }
        }
        return { success: false, ai_obj: {}, items: [], raw: raw2,
          error: "Не удалось извлечь позиции из PDF. Попробуйте загрузить скан в JPG." };
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        console.warn("[PDF] Gemini fallback ошибка:", msg);
        return { success: false, ai_obj: {}, items: [], raw: "",
          error: `Ошибка распознавания PDF: ${msg}. Попробуйте загрузить скан в JPG.` };
      }
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