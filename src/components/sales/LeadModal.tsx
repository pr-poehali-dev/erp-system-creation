import { useState, useMemo, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Client, Staff, SerialProject, api } from "@/lib/api";

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];

interface Props {
  clients: Client[];
  managers: Staff[];
  realtors: Staff[];
  serialProjects: SerialProject[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
  onClientCreated?: (c: Client) => void;
  presetRealtorId?: number | null;
}

export default function LeadModal({ clients, managers, realtors, serialProjects, saving, onClose, onSubmit, onClientCreated, presetRealtorId }: Props) {
  const [managerId, setManagerId]     = useState("");
  const [realtorId, setRealtorId]     = useState(() => presetRealtorId != null ? String(presetRealtorId) : "");
  const [source, setSource]           = useState("");
  const [notes, setNotes]             = useState("");
  const [projectType, setProjectType] = useState<"serial" | "individual">("serial");
  const [spId, setSpId]               = useState("");
  const [address, setAddress]         = useState("");
  const [desiredArea, setDesiredArea] = useState("");
  const [specReq, setSpecReq]         = useState("");
  const [error, setError]             = useState("");

  // Поиск заказчика
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId]         = useState<number | null>(null);
  const [clientName, setClientName]     = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Локальный список клиентов (включает только что созданных)
  const [localClients, setLocalClients] = useState<Client[]>([]);
  const allClients = useMemo(() => {
    const combined = [...clients, ...localClients];
    const seen = new Set<number>();
    return combined.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }, [clients, localClients]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return allClients.slice(0, 20);
    return allClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    ).slice(0, 20);
  }, [allClients, clientSearch]);

  // Закрывать dropdown при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectClient = (c: Client) => {
    setClientId(c.id);
    setClientName(c.name);
    setClientSearch(c.name);
    setShowDropdown(false);
  };

  const clearClient = () => {
    setClientId(null);
    setClientName("");
    setClientSearch("");
  };

  // Форма нового заказчика
  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientError, setNewClientError]   = useState("");

  const handleCreateClient = async () => {
    if (!newName.trim()) { setNewClientError("Укажите ФИО"); return; }
    if (!newPhone.trim()) { setNewClientError("Укажите телефон"); return; }
    setNewClientSaving(true);
    setNewClientError("");
    try {
      const created = await api.clientCreate({ name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() });
      // Добавляем в локальный список и сразу выбираем
      setLocalClients(prev => [...prev, created]);
      selectClient(created);
      onClientCreated?.(created);
      setShowNewClient(false);
      setNewName(""); setNewPhone(""); setNewEmail("");
    } catch (e: unknown) {
      setNewClientError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setNewClientSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!clientId) { setError("Выберите или создайте клиента"); return; }
    // Менеджер обязателен только если не задан presetRealtorId (т.е. создаёт не риэлтор)
    if (!managerId && presetRealtorId == null) { setError("Выберите менеджера"); return; }
    setError("");
    onSubmit({
      client_id:         clientId,
      manager_id:        managerId ? Number(managerId) : null,
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

          {/* Заказчик — поиск + создание */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[13px] font-medium">
                Заказчик <span className="text-red-500">*</span>
              </label>
              <button type="button" onClick={() => { setShowNewClient(v => !v); setNewClientError(""); }}
                className="flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 transition-colors">
                <Icon name={showNewClient ? "X" : "UserPlus"} size={13} />
                {showNewClient ? "Отмена" : "+ Новый заказчик"}
              </button>
            </div>

            {/* Inline-форма создания заказчика */}
            {showNewClient && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="text-[12px] font-semibold text-blue-800 mb-1">Новый заказчик</div>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="ФИО *"
                  className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  placeholder="Телефон *"
                  className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="Email (необязательно)"
                  className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                {newClientError && (
                  <div className="text-[12px] text-red-600 flex items-center gap-1">
                    <Icon name="AlertCircle" size={12} />{newClientError}
                  </div>
                )}
                <button type="button" onClick={handleCreateClient} disabled={newClientSaving}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {newClientSaving
                    ? <><Icon name="Loader2" size={12} className="animate-spin" /> Создаём...</>
                    : <><Icon name="UserCheck" size={12} /> Создать и выбрать</>
                  }
                </button>
              </div>
            )}

            {/* Поле поиска с выпадающим списком */}
            <div className="relative" ref={searchRef}>
              {clientId ? (
                // Выбранный клиент
                <div className="flex items-center gap-2 px-3 py-2 border border-primary bg-primary/5 rounded-lg">
                  <Icon name="UserCheck" size={14} className="text-primary shrink-0" />
                  <span className="text-[13px] font-medium flex-1">{clientName}</span>
                  <button type="button" onClick={clearClient}
                    className="text-muted-foreground hover:text-foreground">
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Начните вводить имя..."
                      className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-hint text-center">
                          {clientSearch ? "Не найдено. Создайте нового заказчика." : "Нет клиентов"}
                        </div>
                      ) : (
                        filteredClients.map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => selectClient(c)}
                            className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                            <div className="text-[13px] font-medium">{c.name}</div>
                            {c.phone && <div className="text-[11px] text-hint">{c.phone}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
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

          {/* Менеджер — не показываем если создаёт риэлтор */}
          {presetRealtorId == null && (
            <div>
              <label className="block text-[13px] font-medium mb-1">Менеджер <span className="text-red-500">*</span></label>
              <select value={managerId} onChange={e => setManagerId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">— Выберите менеджера —</option>
                {managers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Риэлтор */}
          {presetRealtorId == null ? (
            <div>
              <label className="block text-[13px] font-medium mb-1">Риэлтор (если есть)</label>
              <select value={realtorId} onChange={e => setRealtorId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">— Без риэлтора —</option>
                {realtors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-[12px] text-blue-700 flex items-center gap-2">
              <Icon name="UserSquare" size={13} />
              Сделка создаётся от вашего имени как риэлтора
            </div>
          )}

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
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <><Icon name="Loader2" size={14} className="animate-spin" /> Создаём...</> : "Создать лид"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}