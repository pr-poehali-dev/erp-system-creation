import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, MaterialRequest } from "@/lib/api";

interface Props { role: Role; }

// Склад пока без интеграции МойСклад — показываем заявки на материалы как "движение"
// и статичный каталог остатков до подключения МойСклад API

const MOCK_STOCK = [
  { sku: "СБ-001", name: "Блок газобетонный D400 600×250×100", unit: "м³",  stock: 142, reserved: 42, price: 3200,  status: "ok" },
  { sku: "СБ-002", name: "Цемент М500 Д0 (мешок 50 кг)",       unit: "шт",  stock: 18,  reserved: 0,  price: 520,   status: "low" },
  { sku: "АР-014", name: "Арматура А500С Ø12 мм (6м)",          unit: "т",   stock: 0,   reserved: 0,  price: 78000, status: "out" },
  { sku: "КР-003", name: "Профнастил НС-35 RAL 3011",           unit: "м²",  stock: 380, reserved: 180,price: 680,  status: "ok" },
  { sku: "УТ-007", name: "Минвата ROCKWOOL 100мм",              unit: "м²",  stock: 480, reserved: 320,price: 310,  status: "ok" },
  { sku: "ОК-022", name: "Окно ПВХ 1200×1400 (двойной стеклопакет)", unit: "шт", stock: 4, reserved: 4, price: 18500, status: "low" },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ok:  { label: "В наличии", cls: "badge-success" },
  low: { label: "Мало",      cls: "badge-warning" },
  out: { label: "Нет",       cls: "badge-error"   },
};

const PROCUREMENT_STATUS: Record<string, { label: string; cls: string }> = {
  new:       { label: "Новая",     cls: "badge-warning" },
  ordered:   { label: "Заказан",   cls: "badge-info"    },
  delivered: { label: "Доставлен", cls: "badge-success" },
};

const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

export default function Warehouse({ role: _role }: Props) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState(false);

  useEffect(() => {
    api.procurement.list().then(setRequests).finally(() => setLoading(false));
  }, []);

  const delivered = requests.filter(r => r.status === "delivered");
  const pending   = requests.filter(r => r.status !== "delivered");

  const handleSync = () => {
    setSyncMsg(true);
    setTimeout(() => setSyncMsg(false), 3000);
  };

  const outCount = MOCK_STOCK.filter(i => i.status !== "ok").length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Розница / Склад</h1>
          <p className="text-hint mt-0.5">Остатки · заявки на материалы · МойСклад</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors"
          >
            <Icon name="RefreshCw" size={13} />
            Синхронизировать МС
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <Icon name="Info" size={15} className="text-blue-500 shrink-0" />
          <span className="text-[13px] text-blue-800">
            Интеграция с МойСклад в разработке — данные обновятся после подключения API.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Позиций на складе",   value: String(MOCK_STOCK.length), icon: "Package",      color: "text-blue-600 bg-blue-50" },
          { label: "Требуют внимания",     value: String(outCount),          icon: "AlertTriangle", color: "text-red-600 bg-red-50" },
          { label: "Активных заявок",      value: loading ? "..." : String(pending.length), icon: "ShoppingCart", color: "text-emerald-600 bg-emerald-50" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <Icon name={c.icon} size={20} />
            </div>
            <div>
              <div className="text-[22px] font-bold text-foreground">{c.value}</div>
              <div className="text-hint">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Остатки склада</h2>
          <span className="text-hint text-[12px] flex items-center gap-1.5">
            <Icon name="Clock" size={12} />
            Ожидание синхронизации с МойСклад
          </span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Артикул", "Наименование", "Ед.", "На складе", "Резерв", "Цена", "Статус"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MOCK_STOCK.map(item => (
              <tr key={item.sku} className="hover:bg-background transition-colors">
                <td className="px-4 py-3 text-[13px] text-primary font-medium whitespace-nowrap">{item.sku}</td>
                <td className="px-4 py-3 text-[13px] font-medium max-w-xs truncate">{item.name}</td>
                <td className="px-4 py-3 text-hint">{item.unit}</td>
                <td className="px-4 py-3 text-[13px] font-semibold">{item.stock}</td>
                <td className="px-4 py-3 text-hint">{item.reserved}</td>
                <td className="px-4 py-3 text-[13px] whitespace-nowrap">{fmt(item.price)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[item.status].cls}`}>
                    {STATUS_MAP[item.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Active requests from DB */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Активные заявки на материалы</h2>
          <span className="text-hint">из базы данных</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary rounded animate-pulse" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="px-5 py-8 text-center text-hint">Активных заявок нет</div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{r.material}</div>
                  <div className="text-hint text-[12px]">
                    {r.project_code} · {r.quantity} {r.unit}
                    {r.foreman_name ? ` · ${r.foreman_name}` : ""}
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  r.priority === "urgent" ? "badge-error" : "badge-info"
                }`}>
                  {r.priority === "urgent" ? "Срочно" : "Обычно"}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PROCUREMENT_STATUS[r.status]?.cls}`}>
                  {PROCUREMENT_STATUS[r.status]?.label}
                </span>
                <span className="text-hint text-[12px] shrink-0 w-24 text-right">
                  до {r.required_date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivered */}
      {!loading && delivered.length > 0 && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-[15px]">Последние поступления</h2>
          </div>
          <div className="divide-y divide-border">
            {delivered.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <Icon name="CheckCircle" size={15} className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{r.material}</div>
                  <div className="text-hint text-[12px]">{r.project_code} · {r.quantity} {r.unit}</div>
                </div>
                <span className="badge-success text-[11px] px-2 py-0.5 rounded-full font-medium">Доставлен</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}