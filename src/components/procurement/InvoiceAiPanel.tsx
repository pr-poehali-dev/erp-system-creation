import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ApplyData, AiRecognizeResult } from "./invoices.shared";

interface Props {
  result: AiRecognizeResult;
  showDebug: boolean;
  onApply: (d: ApplyData) => void;
  onDismiss: () => void;
}

const FIELDS = [
  { key: "supplier_name", label: "Поставщик" },
  { key: "material",      label: "Материал"  },
  { key: "unit",          label: "Единица"   },
  { key: "unit_price",    label: "Цена/ед."  },
  { key: "quantity",      label: "Кол-во"    },
  { key: "invoice_date",  label: "Дата"      },
  { key: "invoice_number",label: "Номер"     },
];

export default function InvoiceAiPanel({ result, showDebug, onApply, onDismiss }: Props) {
  const [debugOpen, setDebugOpen] = useState(false);

  const handleApply = () => {
    const p = result.parsed;
    const allFilled = ["supplier_name","material","unit_price","quantity"]
      .every(k => p[k] != null && String(p[k]).trim() !== "" && String(p[k]) !== "null");

    onApply({
      // Берём supplier_id и material_id прямо из ответа бэкенда — он уже нашёл/создал
      supplier_id: result.supplier_id != null ? String(result.supplier_id) : "",
      material_id: result.material_id != null ? String(result.material_id) : "",
      unit_price:     p.unit_price  != null && String(p.unit_price)  !== "null" ? String(p.unit_price)  : "",
      quantity:       p.quantity    != null && String(p.quantity)    !== "null" ? String(p.quantity)    : "",
      invoice_date:   p.invoice_date   && String(p.invoice_date)   !== "null" ? String(p.invoice_date)   : "",
      invoice_number: p.invoice_number && String(p.invoice_number) !== "null" ? String(p.invoice_number) : "",
      recognized_data: JSON.stringify(p, null, 2),
      recognition_status: allFilled && !result.debug.parse_error ? "обработан" : "требуется_проверка",
    });
  };

  const d = result.debug;
  const hasParseError = !!d.parse_error;

  return (
    <div className="space-y-2">
      {/* Основная панель результата */}
      <div className={`border rounded-xl p-4 space-y-3 ${hasParseError ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${hasParseError ? "text-amber-800" : "text-emerald-800"}`}>
            <Icon name={hasParseError ? "AlertTriangle" : "Sparkles"} size={14} />
            {hasParseError ? "ИИ ответил, но возникла проблема с парсингом" : "ИИ распознал:"}
          </span>
          <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {FIELDS.map(f => {
            const val = result.parsed[f.key];
            const isEmpty = val == null || String(val).trim() === "" || String(val) === "null";
            return (
              <div key={f.key} className="flex gap-1.5 text-[12px]">
                <span className="text-hint w-20 shrink-0">{f.label}:</span>
                <span className={isEmpty ? "text-hint italic" : "font-medium"}>
                  {isEmpty ? "—" : String(val)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Статус матчинга справочников */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className={`px-2 py-1 rounded-lg ${result.supplier_id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {result.supplier_created ? "✚ Поставщик создан" : result.supplier_id ? "✓ Поставщик найден" : "✗ Поставщик не определён"}
          </div>
          <div className={`px-2 py-1 rounded-lg ${result.material_id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {result.material_created ? "✚ Материал создан" : result.material_id ? "✓ Материал найден" : "✗ Материал не определён"}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={handleApply}
            className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-[13px] font-medium transition-colors ${
              hasParseError ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}>
            <Icon name="Check" size={13} />
            Применить данные
          </button>
          <button type="button" onClick={onDismiss}
            className="px-3 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
            Игнорировать
          </button>
          {showDebug && (
            <button type="button" onClick={() => setDebugOpen(v => !v)}
              className="ml-auto px-3 py-2 border border-border rounded-lg text-[11px] text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1">
              <Icon name="Bug" size={12} />
              {debugOpen ? "Скрыть debug" : "Debug"}
            </button>
          )}
        </div>
      </div>

      {/* Отладочный блок (только для ролей с AI) */}
      {showDebug && debugOpen && (
        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 space-y-3 text-[11px] font-mono overflow-x-auto">
          <div className="text-gray-400 font-sans font-semibold text-[12px] flex items-center gap-1.5">
            <Icon name="Bug" size={13} />
            Отладочная информация AI
          </div>

          <div>
            <div className="text-yellow-400 mb-1">Сырой ответ от Polza.ai:</div>
            <pre className="text-green-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-gray-800 rounded p-2">
              {d.raw_response || "(пусто)"}
            </pre>
          </div>

          {d.parse_error && (
            <div>
              <div className="text-red-400 mb-1">Ошибка парсинга JSON:</div>
              <pre className="text-red-300 whitespace-pre-wrap bg-gray-800 rounded p-2">{d.parse_error}</pre>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <div>
              <div className="text-blue-400 mb-0.5">Поставщик:</div>
              <div className="text-gray-300 bg-gray-800 rounded px-2 py-1">{d.supplier_action || "—"}</div>
            </div>
            <div>
              <div className="text-blue-400 mb-0.5">Материал:</div>
              <div className="text-gray-300 bg-gray-800 rounded px-2 py-1">{d.material_action || "—"}</div>
            </div>
          </div>

          <div>
            <div className="text-yellow-400 mb-1">Распознанный и нормализованный JSON:</div>
            <pre className="text-cyan-300 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-800 rounded p-2">
              {JSON.stringify(result.parsed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
