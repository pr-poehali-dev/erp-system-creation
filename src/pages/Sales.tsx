import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff } from "@/lib/api";
import SalesFunnel from "@/components/sales/SalesFunnel";
import DealsTable from "@/components/sales/DealsTable";
import DealModal, { DealFormState } from "@/components/sales/DealModal";

interface Props { role: Role; }

const EMPTY_FORM: DealFormState = {
  client_id: "",
  source: "",
  budget: "",
  slot_id: "",
  manager_id: "",
  realtor_id: "",
  notes: "",
};

export default function Sales({ role: _role }: Props) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Staff[]>([]);
  const [realtors, setRealtors] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DealFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [contractMsg, setContractMsg] = useState<number | null>(null);
  const [stagingSaving, setStagingSaving] = useState<number | null>(null);

  const loadDeals = () => {
    setLoading(true);
    api.deals.list().then(setDeals).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeals();
    api.clients().then(setClients);
    api.staff("crm_manager").then(setManagers);
    api.staff("realtor").then(setRealtors);
  }, []);

  const handleOpenModal = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormError("");
  };

  const handleField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSlotSelect = (slotId: string) => {
    setForm((prev) => ({ ...prev, slot_id: slotId }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id)  { setFormError("Выберите клиента"); return; }
    if (!form.budget)     { setFormError("Укажите бюджет"); return; }
    if (!form.slot_id)    { setFormError("Выберите слот для старта строительства"); return; }
    if (!form.manager_id) { setFormError("Выберите менеджера"); return; }

    setSaving(true);
    setFormError("");
    try {
      await api.deals.create({
        client_id:  Number(form.client_id),
        source:     form.source,
        budget:     Number(form.budget),
        slot_id:    Number(form.slot_id),
        manager_id: Number(form.manager_id),
        realtor_id: form.realtor_id ? Number(form.realtor_id) : null,
        notes:      form.notes,
      });
      handleCloseModal();
      loadDeals();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (deal: Deal, newStage: string) => {
    setStagingSaving(deal.id);
    try {
      await api.deals.updateStage(deal.id, newStage);
      if (newStage === "contract") {
        setContractMsg(deal.id);
        setTimeout(() => setContractMsg(null), 4000);
      }
      loadDeals();
    } finally {
      setStagingSaving(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Продажи и CRM</h1>
          <p className="text-hint mt-0.5">Воронка продаж, сделки, договоры</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="Plus" size={14} />
          Новая сделка
        </button>
      </div>

      <SalesFunnel deals={deals} loading={loading} />

      {contractMsg !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">
            Сделка переведена в «Договор» — проект создан автоматически
          </span>
        </div>
      )}

      <DealsTable
        deals={deals}
        loading={loading}
        stagingSaving={stagingSaving}
        onRefresh={loadDeals}
        onStageChange={handleStageChange}
      />

      {modalOpen && (
        <DealModal
          form={form}
          clients={clients}
          managers={managers}
          realtors={realtors}
          saving={saving}
          formError={formError}
          onClose={handleCloseModal}
          onField={handleField}
          onSlotSelect={handleSlotSelect}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
