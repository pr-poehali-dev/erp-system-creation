import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, SerialProject, EstimateData, EstimateStage } from "@/lib/api";

interface Props { role: Role; }

const fmt = (n: number) => n.toLocaleString("ru", { minimumFractionDigits: 0 });
const fmtRub = (n: number) => `${fmt(n)} ₽`;
const UNITS = ["шт", "м²", "м³", "м/п", "кг", "т", "л", "уп", "компл", "услуга"];

// Форма добавления строки
function AddRowForm({
  stageNum,
  type,
  spId,
  onSave,
  onCancel,
}: {
  stageNum: number;
  type: "work" | "material";
  spId: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName]         = useState("");
  const [unit, setUnit]         = useState("шт");
  const [qty, setQty]           = useState("");
  const [price, setPrice]       = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!name || !qty || !price) return;
    setSaving(true);
    try {
      if (type === "work") {
        await api.estimate.saveWork({
          serial_project_id: spId,
          stage_num: stageNum,
          work_name: name,
          unit, quantity: Number(qty), unit_price: Number(price),
        });
      } else {
        await api.estimate.saveMaterial({
          serial_project_id: spId,
          stage_num: stageNum,
          material_name: name,
          unit, quantity: Number(qty), unit_price: Number(price),
          supplier_hint: supplier,
        });
      }
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-3 py-2">
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder={type === "work" ? "Название работы" : "Название материала"}
          className="w-full border border-border rounded px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
      </td>
      <td className="px-2 py-2">
        <select value={unit} onChange={e => setUnit(e.target.value)}
          className="w-full border border-border rounded px-2 py-1 text-[12px] outline-none">
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="number" value={qty} onChange={e => setQty(e.target.value)}
          placeholder="0" min={0}
          className="w-20 border border-border rounded px-2 py-1 text-[12px] outline-none text-right focus:ring-1 focus:ring-primary" />
      </td>
      <td className="px-2 py-2">
        <input type="number" value={price} onChange={e => setPrice(e.target.value)}
          placeholder="0" min={0}
          className="w-24 border border-border rounded px-2 py-1 text-[12px] outline-none text-right focus:ring-1 focus:ring-primary" />
      </td>
      {type === "material" && (
        <td className="px-2 py-2">
          <input value={supplier} onChange={e => setSupplier(e.target.value)}
            placeholder="Поставщик"
            className="w-full border border-border rounded px-2 py-1 text-[12px] outline-none" />
        </td>
      )}
      <td className="px-2 py-2 text-right text-[12px] text-muted-foreground">
        {qty && price ? fmtRub(Number(qty) * Number(price)) : "—"}
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving || !name || !qty || !price}
            className="px-2 py-1 bg-primary text-white rounded text-[11px] disabled:opacity-40">
            {saving ? "..." : "OK"}
          </button>
          <button onClick={onCancel} className="px-2 py-1 border border-border rounded text-[11px] hover:bg-secondary">
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

// Блок одного этапа
function StageBlock({
  stage, spId, canEdit, onRefresh,
}: {
  stage: EstimateStage;
  spId: number;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [addWork, setAddWork]     = useState(false);
  const [addMat, setAddMat]       = useState(false);
  const [expanded, setExpanded]   = useState(stage.works.length > 0 || stage.materials.length > 0);

  const hasData = stage.works.length > 0 || stage.materials.length > 0;

  return (
    <div className={`border rounded-xl overflow-hidden ${hasData ? "border-border" : "border-dashed border-border/60"}`}>
      {/* Заголовок этапа */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-secondary/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">{stage.stage_num}</span>
          </div>
          <div>
            <span className="text-[13px] font-semibold text-foreground">{stage.stage_name}</span>
            <span className="text-hint text-[11px] ml-2">
              {stage.works.length > 0 ? `${stage.works.length} работ` : ""}
              {stage.works.length > 0 && stage.materials.length > 0 ? " · " : ""}
              {stage.materials.length > 0 ? `${stage.materials.length} материалов` : ""}
              {!hasData ? "Пусто" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {hasData && (
            <div className="text-right">
              <div className="text-[13px] font-bold text-foreground">{fmtRub(stage.stage_total)}</div>
              <div className="text-[10px] text-hint">
                {stage.works_total > 0 && `работы ${fmtRub(stage.works_total)}`}
                {stage.works_total > 0 && stage.mats_total > 0 && " · "}
                {stage.mats_total > 0 && `материалы ${fmtRub(stage.mats_total)}`}
              </div>
            </div>
          )}
          <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* РАБОТЫ */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-blue-700 flex items-center gap-1.5">
                <Icon name="Hammer" size={12} />
                Работы
              </span>
              {canEdit && !addWork && (
                <button onClick={() => setAddWork(true)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Icon name="Plus" size={11} /> Добавить
                </button>
              )}
            </div>
            {stage.works.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-hint border-b border-border">
                    <th className="text-left pb-1 font-medium">Работа</th>
                    <th className="text-left pb-1 font-medium w-16">Ед.</th>
                    <th className="text-right pb-1 font-medium w-16">Кол-во</th>
                    <th className="text-right pb-1 font-medium w-24">Цена</th>
                    <th className="text-right pb-1 font-medium w-24">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.works.map(w => (
                    <tr key={w.id} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 text-foreground">{w.work_name}</td>
                      <td className="py-1.5 text-hint">{w.unit}</td>
                      <td className="py-1.5 text-right">{fmt(w.quantity)}</td>
                      <td className="py-1.5 text-right text-hint">{fmt(w.unit_price)}</td>
                      <td className="py-1.5 text-right font-medium">{fmtRub(w.quantity * w.unit_price)}</td>
                    </tr>
                  ))}
                  {addWork && (
                    <AddRowForm stageNum={stage.stage_num} type="work" spId={spId}
                      onSave={() => { setAddWork(false); onRefresh(); }}
                      onCancel={() => setAddWork(false)} />
                  )}
                </tbody>
              </table>
            ) : (
              <div className="text-hint text-[12px] py-2">
                {canEdit ? (
                  addWork ? (
                    <table className="w-full"><tbody>
                      <AddRowForm stageNum={stage.stage_num} type="work" spId={spId}
                        onSave={() => { setAddWork(false); onRefresh(); }}
                        onCancel={() => setAddWork(false)} />
                    </tbody></table>
                  ) : "Нет работ — добавьте первую"
                ) : "Нет данных"}
              </div>
            )}
          </div>

          {/* МАТЕРИАЛЫ */}
          <div className="px-4 pb-3 border-t border-border/40">
            <div className="flex items-center justify-between mt-3 mb-2">
              <span className="text-[12px] font-semibold text-amber-700 flex items-center gap-1.5">
                <Icon name="Package" size={12} />
                Материалы
              </span>
              {canEdit && !addMat && (
                <button onClick={() => setAddMat(true)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Icon name="Plus" size={11} /> Добавить
                </button>
              )}
            </div>
            {stage.materials.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-hint border-b border-border">
                    <th className="text-left pb-1 font-medium">Материал</th>
                    <th className="text-left pb-1 font-medium w-16">Ед.</th>
                    <th className="text-right pb-1 font-medium w-16">Кол-во</th>
                    <th className="text-right pb-1 font-medium w-24">Цена</th>
                    <th className="text-left pb-1 font-medium w-32">Поставщик</th>
                    <th className="text-right pb-1 font-medium w-24">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.materials.map(m => (
                    <tr key={m.id} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 text-foreground">{m.material_name}</td>
                      <td className="py-1.5 text-hint">{m.unit}</td>
                      <td className="py-1.5 text-right">{fmt(m.quantity)}</td>
                      <td className="py-1.5 text-right text-hint">{fmt(m.unit_price)}</td>
                      <td className="py-1.5 text-hint truncate max-w-[120px]">{m.supplier_hint || "—"}</td>
                      <td className="py-1.5 text-right font-medium">{fmtRub(m.quantity * m.unit_price)}</td>
                    </tr>
                  ))}
                  {addMat && (
                    <AddRowForm stageNum={stage.stage_num} type="material" spId={spId}
                      onSave={() => { setAddMat(false); onRefresh(); }}
                      onCancel={() => setAddMat(false)} />
                  )}
                </tbody>
              </table>
            ) : (
              <div className="text-hint text-[12px] py-2">
                {canEdit ? (
                  addMat ? (
                    <table className="w-full"><tbody>
                      <AddRowForm stageNum={stage.stage_num} type="material" spId={spId}
                        onSave={() => { setAddMat(false); onRefresh(); }}
                        onCancel={() => setAddMat(false)} />
                    </tbody></table>
                  ) : "Нет материалов — добавьте первый"
                ) : "Нет данных"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Estimate({ role }: Props) {
  const [projects, setProjects]     = useState<SerialProject[]>([]);
  const [selectedSp, setSelectedSp] = useState<number | null>(null);
  const [estimate, setEstimate]     = useState<EstimateData | null>(null);
  const [loading, setLoading]       = useState(false);

  const canEdit = ["director", "commercial", "supply_director"].includes(role);

  useEffect(() => {
    api.serial_projects.list().then(list => {
      setProjects(list);
      if (list.length === 1) setSelectedSp(list[0].id);
    });
  }, []);

  const loadEstimate = (spId: number) => {
    setLoading(true);
    api.estimate.get(spId).then(setEstimate).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedSp) loadEstimate(selectedSp);
  }, [selectedSp]);

  const sp = projects.find(p => p.id === selectedSp);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Смета серийного проекта</h1>
          <p className="text-hint mt-0.5">Работы и материалы по этапам · плановые объёмы для строительства и снабжения</p>
        </div>
      </div>

      {/* Выбор проекта */}
      <div className="flex gap-2 flex-wrap">
        {projects.map(p => (
          <button key={p.id}
            onClick={() => setSelectedSp(p.id)}
            className={`px-4 py-2 rounded-xl border text-[13px] font-medium transition-all ${
              selectedSp === p.id
                ? "border-primary bg-primary text-white"
                : "border-border bg-white hover:border-primary/40 text-foreground"
            }`}>
            {p.name}
            {p.id === selectedSp && (
              <span className="ml-2 text-[11px] opacity-80">{p.area_sqm} м²</span>
            )}
          </button>
        ))}
      </div>

      {!selectedSp ? (
        <div className="text-center text-hint py-20">Выберите серийный проект</div>
      ) : loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : estimate ? (
        <>
          {/* Итоговая шапка */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Работы (итого)", val: estimate.total_works, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
              { label: "Материалы (итого)", val: estimate.total_materials, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
              { label: "Полная смета", val: estimate.grand_total, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
            ].map(item => (
              <div key={item.label} className={`border rounded-xl p-4 ${item.bg}`}>
                <div className="text-[12px] font-medium text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-[18px] font-bold ${item.color}`}>{fmtRub(item.val)}</div>
              </div>
            ))}
          </div>

          {/* Этапы */}
          <div className="space-y-3">
            {estimate.stages.map(stage => (
              <StageBlock key={stage.stage_num}
                stage={stage}
                spId={selectedSp}
                canEdit={canEdit}
                onRefresh={() => loadEstimate(selectedSp)}
              />
            ))}
          </div>

          {canEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-blue-800">
                При создании проекта из договора система автоматически создаёт плановые заявки
                на материалы для снабженца на основе этой сметы.
              </span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
