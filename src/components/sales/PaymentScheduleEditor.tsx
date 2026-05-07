import { useEffect, useState } from "react";
import { api, PaymentScheduleItem, Deal } from "@/lib/api";
import Icon from "@/components/ui/icon";

interface Props {
  deal: Deal;
  readonly?: boolean;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

export default function PaymentScheduleEditor({ deal, readonly = false }: Props) {
  const [items, setItems] = useState<PaymentScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = () => {
    setLoading(true);
    api.payment_schedule.list(deal.id)
      .then(data => { setItems(data); setDirty(false); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [deal.id]);

  const addRow = () => {
    const next = items.length + 1;
    setItems(prev => [...prev, { order_index: next, stage_name: "", amount: 0, status: "pending" }]);
    setDirty(true);
  };

  const updateRow = (idx: number, field: keyof PaymentScheduleItem, value: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order_index: i + 1 })));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.payment_schedule.save(deal.id, items);
      setItems(saved);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: PaymentScheduleItem) => {
    if (!item.id) return;
    const next = item.status === "paid" ? "pending" : "paid";
    await api.payment_schedule.setStatus(deal.id, item.id, next);
    load();
  };

  const totalAmount = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const paidAmount  = items.filter(it => it.status === "paid").reduce((s, it) => s + Number(it.amount || 0), 0);
  const paidPct     = totalAmount > 0 ? Math.round(paidAmount / totalAmount * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1,2].map(i => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Полоса оплаты */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px] text-muted-foreground">
            <span>Оплачено: <span className="font-semibold text-emerald-600">{fmtMoney(paidAmount)}</span></span>
            <span>Итого: <span className="font-semibold">{fmtMoney(totalAmount)}</span> · {paidPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      )}

      {/* Таблица */}
      {items.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium w-8">№</th>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">Этап / Назначение</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium w-32">Сумма, ₽</th>
                <th className="px-3 py-2 text-center text-muted-foreground font-medium w-28">Статус</th>
                {!readonly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, idx) => (
                <tr key={item.id ?? `new-${idx}`} className={item.status === "paid" ? "bg-emerald-50/40" : ""}>
                  <td className="px-3 py-2 text-muted-foreground text-center">{item.order_index}</td>
                  <td className="px-3 py-2">
                    {readonly ? (
                      <span>{item.stage_name || "—"}</span>
                    ) : (
                      <input
                        value={item.stage_name}
                        onChange={e => updateRow(idx, "stage_name", e.target.value)}
                        placeholder="Название этапа/платежа"
                        className="w-full outline-none bg-transparent placeholder:text-muted-foreground/50"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {readonly ? (
                      <span className="font-medium">{fmtMoney(Number(item.amount))}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={item.amount}
                        onChange={e => updateRow(idx, "amount", parseFloat(e.target.value) || 0)}
                        className="w-full text-right outline-none bg-transparent"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleStatus(item)}
                      disabled={!item.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        item.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:cursor-default`}
                    >
                      {item.status === "paid"
                        ? <><Icon name="CheckCircle" size={10} /> Оплачен</>
                        : <><Icon name="Clock" size={10} /> Ожидает</>
                      }
                    </button>
                  </td>
                  {!readonly && (
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Icon name="X" size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && !readonly && (
        <div className="text-center py-6 text-muted-foreground text-[13px] border border-dashed border-border rounded-lg">
          График оплат не задан. Нажмите «Добавить строку».
        </div>
      )}

      {/* Кнопки */}
      {!readonly && (
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Icon name="Plus" size={13} />
            Добавить строку
          </button>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Save" size={13} />}
              Сохранить
            </button>
          )}
        </div>
      )}
    </div>
  );
}
