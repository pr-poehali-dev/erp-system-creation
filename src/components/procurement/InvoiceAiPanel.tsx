import { Supplier, Material } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { ApplyData } from "./invoices.shared";

interface Props {
  result: Record<string, unknown>;
  suppliers: Supplier[];
  materials: Material[];
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

export default function InvoiceAiPanel({ result, suppliers, materials, onApply, onDismiss }: Props) {
  const handleApply = () => {
    const sName = String(result.supplier_name || "").trim().toLowerCase();
    const mName = String(result.material       || "").trim().toLowerCase();
    const ms = suppliers.find(s => s.name.toLowerCase() === sName);
    const mm = materials.find(m => m.name.toLowerCase() === mName);
    const allFilled = ["supplier_name","material","unit_price","quantity"]
      .every(k => result[k] != null && result[k] !== "");
    onApply({
      supplier_id:    ms ? String(ms.id) : "",
      material_id:    mm ? String(mm.id) : "",
      unit_price:     result.unit_price   != null ? String(result.unit_price)   : "",
      quantity:       result.quantity     != null ? String(result.quantity)     : "",
      invoice_date:   result.invoice_date   ? String(result.invoice_date)   : "",
      invoice_number: result.invoice_number ? String(result.invoice_number) : "",
      recognized_data: JSON.stringify(result, null, 2),
      recognition_status: allFilled ? "обработан" : "требуется_проверка",
    });
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
          <Icon name="Sparkles" size={14} />
          ИИ распознал:
        </span>
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <Icon name="X" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {FIELDS.map(f => (
          <div key={f.key} className="flex gap-1.5 text-[12px]">
            <span className="text-hint w-20 shrink-0">{f.label}:</span>
            <span className={result[f.key] != null ? "font-medium" : "text-hint italic"}>
              {result[f.key] != null ? String(result[f.key]) : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors">
          <Icon name="Check" size={13} />
          Применить данные
        </button>
        <button type="button" onClick={onDismiss}
          className="px-3 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
          Игнорировать
        </button>
      </div>
    </div>
  );
}
