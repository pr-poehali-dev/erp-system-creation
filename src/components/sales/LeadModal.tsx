import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Client, Staff, SerialProject } from "@/lib/api";

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];

interface Props {
  clients: Client[];
  managers: Staff[];
  realtors: Staff[];
  serialProjects: SerialProject[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function LeadModal({ clients, managers, realtors, serialProjects, saving, onClose, onSubmit }: Props) {
  const [clientId, setClientId]       = useState("");
  const [managerId, setManagerId]     = useState("");
  const [realtorId, setRealtorId]     = useState("");
  const [source, setSource]           = useState("");
  const [notes, setNotes]             = useState("");
  const [projectType, setProjectType] = useState<"serial" | "individual">("serial");
  const [spId, setSpId]               = useState("");
  const [address, setAddress]         = useState("");
  const [desiredArea, setDesiredArea] = useState("");
  const [specReq, setSpecReq]         = useState("");
  const [error, setError]             = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!clientId)  { setError("Выберите клиента"); return; }
    if (!managerId) { setError("Выберите менеджера"); return; }
    setError("");
    onSubmit({
      client_id:         Number(clientId),
      manager_id:        Number(managerId),
      realtor_id:        realtorId ? Number(realtorId) : null,
      source,
      notes,
      project_type:      projectType,
      serial_project_id: spId ? Number(spId) : null,
      address,
      desired_area:      desiredArea ? Number(desiredArea) : 0,
      special_requests:  specReq,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Новый лид</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* Тип проекта */}
          <div>
            <label className="block text-[13px] font-medium mb-2">Тип проекта</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { val: "serial", label: "Серийный", icon: "Home", hint: "Стандартная серия" },
                { val: "individual", label: "Индивидуальный", icon: "Pencil", hint: "Под заказ" },
              ] as const).map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setProjectType(opt.val)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    projectType === opt.val
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon name={opt.icon} size={13} className="text-primary" />
                    <span className="text-[13px] font-semibold">{opt.label}</span>
                  </div>
                  <div className="text-hint text-[11px]">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Серийный проект */}
          {projectType === "serial" && (
            <div>
              <label className="block text-[13px] font-medium mb-1">Серия (ориентировочно)</label>
              <select value={spId} onChange={e => setSpId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">— Выберите серию —</option>
                {serialProjects.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name} · {sp.area_sqm} м²</option>
                ))}
              </select>
            </div>
          )}

          {/* Индивидуальный */}
          {projectType === "individual" && (
            <>
              <div>
                <label className="block text-[13px] font-medium mb-1">Желаемая площадь (м²)</label>
                <input type="number" value={desiredArea} onChange={e => setDesiredArea(e.target.value)}
                  placeholder="150"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Пожелания клиента</label>
                <textarea value={specReq} onChange={e => setSpecReq(e.target.value)} rows={2}
                  placeholder="Особые требования..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </>
          )}

          {/* Место строительства */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Место строительства</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Район, участок..."
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Клиент */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Клиент <span className="text-red-500">*</span></label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите клиента —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>

          {/* Источник */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Источник</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Источник —</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Менеджер */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Менеджер <span className="text-red-500">*</span></label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите менеджера —</option>
              {managers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Риэлтор */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Риэлтор (если есть)</label>
            <select value={realtorId} onChange={e => setRealtorId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Без риэлтора —</option>
              {realtors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Примечания */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Примечания</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? "Создание..." : "Создать лид"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}