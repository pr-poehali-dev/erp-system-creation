import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AiRecognizeResult, AiItem, fmtMoney } from "./invoices.shared";

interface Props {
  result: AiRecognizeResult;
  showDebug: boolean;
  applying: boolean;
  onApply: (selectedItems: AiItem[], invoiceDate: string, invoiceNumber: string) => void;
  onDismiss: () => void;
}

export default function InvoiceAiPanel({ result, showDebug, applying, onApply, onDismiss }: Props) {
  const [selected,      setSelected]     = useState<boolean[]>(() => result.items.map(() => true));
  const [invoiceDate,   setInvoiceDate]  = useState(result.meta.invoice_date   || "");
  const [invoiceNumber, setInvoiceNumber]= useState(result.meta.invoice_number || "");
  const [debugOpen,     setDebugOpen]    = useState(false);

  const hasParseError = !!result.parse_error;
  const allComplete   = result.items.every(i => i.complete);
  const checkedCount  = selected.filter(Boolean).length;

  const toggleAll = () => {
    const allOn = selected.every(Boolean);
    setSelected(selected.map(() => !allOn));
  };

  const handleApply = () => {
    const chosenItems = result.items.filter((_, i) => selected[i]);
    onApply(chosenItems, invoiceDate, invoiceNumber);
  };

  const pluralInvoice = (n: number) =>
    n === 1 ? "счёт" : n < 5 ? "счёта" : "счетов";

  return (
    <div className="space-y-3">
      {/* Заголовок-карточка */}
      <div className={`border rounded-xl p-4 space-y-3 ${hasParseError ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${hasParseError ? "text-amber-800" : "text-emerald-800"}`}>
            <Icon name={hasParseError ? "AlertTriangle" : "Sparkles"} size={14} />
            {hasParseError
              ? "Проблема с парсингом — проверьте данные"
              : `ИИ распознал ${result.items.length} ${result.items.length === 1 ? "позицию" : result.items.length < 5 ? "позиции" : "позиций"}`
            }
          </span>
          <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        </div>

        {/* Общие поля: дата и номер из meta */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-hint mb-1">Дата счёта (общая)</label>
            <input type="date" value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white" />
          </div>
          <div>
            <label className="block text-[11px] text-hint mb-1">Номер счёта (общий)</label>
            <input value={invoiceNumber} placeholder="СФ-0001"
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white" />
          </div>
        </div>

        {/* Таблица позиций */}
        {result.items.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-secondary/60 text-hint">
                    <th className="px-2 py-1.5 w-7 text-center">
                      <input type="checkbox" checked={selected.every(Boolean)} onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Поставщик</th>
                    <th className="px-2 py-1.5 text-left font-medium">Материал</th>
                    <th className="px-2 py-1.5 text-left font-medium">Ед.</th>
                    <th className="px-2 py-1.5 text-right font-medium">Цена</th>
                    <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                    <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                    <th className="px-2 py-1.5 w-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {result.items.map((item, idx) => {
                    const total = item.unit_price != null && item.quantity != null
                      ? item.unit_price * item.quantity : null;
                    return (
                      <tr key={idx} className={`transition-opacity ${selected[idx] ? "" : "opacity-40"}`}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={selected[idx]}
                            onChange={() => setSelected(s => s.map((v, i) => i === idx ? !v : v))}
                            className="cursor-pointer" />
                        </td>
                        <td className="px-2 py-2 max-w-[90px]">
                          <div className="truncate">{item.supplier_name || <span className="text-hint italic">—</span>}</div>
                          {item.supplier_created && <div className="text-[9px] text-emerald-600">✚ создан</div>}
                        </td>
                        <td className="px-2 py-2 max-w-[110px]">
                          <div className="truncate">{item.material || <span className="text-hint italic">—</span>}</div>
                          {item.material_created && <div className="text-[9px] text-emerald-600">✚ создан</div>}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{item.unit}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{fmtMoney(item.unit_price)}</td>
                        <td className="px-2 py-2 text-right">{item.quantity ?? "—"}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap font-medium">{fmtMoney(total)}</td>
                        <td className="px-2 py-2 text-center">
                          {item.complete
                            ? <Icon name="CheckCircle" size={11} className="text-emerald-500" />
                            : <Icon name="AlertCircle" size={11} className="text-amber-500" />
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!allComplete && result.items.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-white border border-amber-200 rounded-lg px-3 py-2">
            <Icon name="AlertTriangle" size={12} className="shrink-0" />
            Позиции с <Icon name="AlertCircle" size={10} className="inline text-amber-500" /> получат статус «Требует проверки»
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" onClick={handleApply}
            disabled={applying || checkedCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {applying
              ? <><Icon name="Loader" size={13} className="animate-spin" />Создаём счета...</>
              : <><Icon name="Check" size={13} />Создать {checkedCount} {pluralInvoice(checkedCount)}</>
            }
          </button>
          <button type="button" onClick={onDismiss} disabled={applying}
            className="px-3 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
            Отмена
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

      {/* Отладочный блок */}
      {showDebug && debugOpen && (
        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 space-y-3 text-[11px] font-mono overflow-x-auto">
          <div className="text-gray-400 font-sans font-semibold text-[12px] flex items-center gap-1.5">
            <Icon name="Bug" size={13} />
            Отладочная информация AI
          </div>
          <div>
            <div className="text-yellow-400 mb-1">Сырой ответ от Polza.ai:</div>
            <pre className="text-green-300 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-gray-800 rounded p-2">
              {result.debug.raw_response || "(пусто)"}
            </pre>
          </div>
          {result.parse_error && (
            <div>
              <div className="text-red-400 mb-1">Ошибка парсинга:</div>
              <pre className="text-red-300 whitespace-pre-wrap bg-gray-800 rounded p-2">{result.parse_error}</pre>
            </div>
          )}
          {result.debug.items_debug.length > 0 && (
            <div>
              <div className="text-blue-400 mb-1">Позиции (матчинг справочников):</div>
              {result.debug.items_debug.map((line, i) => (
                <div key={i} className="text-gray-300 bg-gray-800 rounded px-2 py-0.5 mb-0.5">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
