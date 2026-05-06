import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

const MATERIALS = [
  "Кирпич рядовой",
  "Кирпич облицовочный",
  "Блок газобетонный",
  "Цемент М500",
  "Песок строительный",
  "Щебень фракция 20-40",
  "Арматура 12мм",
  "Арматура 16мм",
  "Доска обрезная 50×150",
  "Брус 150×150",
  "Утеплитель минвата",
  "Пеноплекс 50мм",
  "Мембрана гидроизоляционная",
  "Профлист С-8",
  "Металлочерепица",
  "Труба ПВХ 110мм",
  "Кабель ВВГнг 3×2.5",
  "Смесь штукатурная",
  "Плиты перекрытия",
  "Бетон товарный М300",
];

const UNITS = ["шт", "м²", "м³", "пог.м", "кг", "т", "л", "мешок", "рулон", "лист"];

interface Props {
  projectId: number;
  projectCode: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function MaterialRequestModal({ projectId, projectCode, onClose, onCreated }: Props) {
  const [material, setMaterial] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("шт");
  const [requiredDate, setRequiredDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const materialName = material === "__custom__" ? customMaterial : material;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim()) { setError("Укажите материал"); return; }
    if (!quantity || Number(quantity) <= 0) { setError("Укажите количество"); return; }
    if (!requiredDate) { setError("Укажите дату поставки"); return; }

    setSaving(true);
    setError("");
    try {
      await api.procurement.create({
        project_id: projectId,
        material: materialName.trim(),
        quantity: Number(quantity),
        unit,
        required_date: requiredDate,
        priority: "normal",
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold">Заявка на материалы</h2>
            <p className="text-hint text-[12px] mt-0.5">Проект {projectCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Материал */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Материал</label>
            <select
              value={material}
              onChange={e => { setMaterial(e.target.value); setCustomMaterial(""); }}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">— выберите из списка —</option>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom__">Другой (ввести вручную)</option>
            </select>
            {material === "__custom__" && (
              <input
                type="text"
                value={customMaterial}
                onChange={e => setCustomMaterial(e.target.value)}
                placeholder="Введите название материала"
                className="mt-2 w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            )}
          </div>

          {/* Количество + единица */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[13px] font-medium mb-1.5">Количество</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="w-28">
              <label className="block text-[13px] font-medium mb-1.5">Единица</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Дата поставки */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Желаемая дата поставки</label>
            <input
              type="date"
              value={requiredDate}
              onChange={e => setRequiredDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" />
              <span className="text-[12px] text-red-600">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-lg text-[13px] font-medium hover:bg-secondary transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <><Icon name="Loader" size={14} className="animate-spin" /> Сохраняю...</>
                : <><Icon name="PackagePlus" size={14} /> Создать заявку</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
