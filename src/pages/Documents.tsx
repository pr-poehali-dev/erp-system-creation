import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Document, Contractor, Deal, PayoutDeal } from "@/lib/api";
import ContractReviewModal from "@/components/director/ContractReviewModal";
import { DirectorPendingDeals, DirectorPendingPayouts } from "@/components/documents/DirectorDocAlerts";
import DocumentCreateModal from "@/components/documents/DocumentCreateModal";
import DocumentsTable from "@/components/documents/DocumentsTable";
import { DOC_TYPES_BY_CATEGORY } from "@/components/documents/DocumentsConst";

interface Props { role: Role; }

interface FormState {
  doc_type: string; category: string; title: string; status: string;
  amount: string; doc_date: string; contractor_id: string; deal_id: string; notes: string;
}

const EMPTY_FORM: FormState = {
  doc_type: "", category: "", title: "", status: "draft",
  amount: "", doc_date: "", contractor_id: "", deal_id: "", notes: "",
};

export default function Documents({ role }: Props) {
  const [docs, setDocs]               = useState<Document[]>([]);
  const [loading, setLoading]         = useState(true);
  const [category, setCategory]       = useState("");
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatus]     = useState("");
  const [modalOpen, setModalOpen]     = useState(false);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const [pendingDeals, setPendingDeals]     = useState<Deal[]>([]);
  const [reviewDeal, setReviewDeal]         = useState<Deal | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutDeal[]>([]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isDirector = role === "director";
  const canEdit = ["director", "commercial", "supply_director", "finance_director"].includes(role);

  const load = () => {
    setLoading(true);
    api.documents.list(category ? { category } : {}).then(setDocs).finally(() => setLoading(false));
  };

  const loadPendingDeals = () => {
    if (!isDirector) return;
    api.deals.list().then(deals => {
      const pending = deals.filter(d =>
        ["docs_review", "docs_approved", "payment_pending"].includes(d.contract_status || "")
      );
      setPendingDeals(pending);
    });
    api.payout_requests.list().then(r => {
      setPendingPayouts(r.deals.filter(d => d.payout_status === "pending" && d.invoice_file_url));
    });
  };

  useEffect(() => { load(); }, [category]);

  useEffect(() => {
    api.contractors.list().then(setContractors);
    loadPendingDeals();
  }, []);

  const countsByCategory: Record<string, number> = {};
  docs.forEach(d => { countsByCategory[d.category] = (countsByCategory[d.category] || 0) + 1; });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doc_type || !form.title) { setError("Заполните тип и название"); return; }
    setSaving(true);
    try {
      const cat = form.category || Object.keys(DOC_TYPES_BY_CATEGORY).find(k =>
        DOC_TYPES_BY_CATEGORY[k].some(t => t.key === form.doc_type)) || "general";
      await api.documents.create({
        ...form,
        category: cat,
        amount: form.amount ? Number(form.amount) : null,
        contractor_id: form.contractor_id ? Number(form.contractor_id) : null,
        deal_id: form.deal_id ? Number(form.deal_id) : null,
      });
      setModalOpen(false);
      load();
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Документы</h1>
          <p className="text-hint mt-0.5">
            Все документы компании · сделки, поставщики, подрядчики, внутренние
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => { setError(""); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
              <Icon name="Plus" size={14} />
              Добавить документ
            </button>
          )}
        </div>
      </div>

      {/* Директор: документы на подписание */}
      {isDirector && (
        <DirectorPendingDeals
          pendingDeals={pendingDeals}
          onOpen={setReviewDeal}
        />
      )}

      {/* Директор: счета от менеджеров */}
      {isDirector && (
        <DirectorPendingPayouts pendingPayouts={pendingPayouts} />
      )}

      {/* Таблица с фильтрами и категориями */}
      <DocumentsTable
        docs={docs}
        loading={loading}
        category={category}
        search={search}
        statusFilter={statusFilter}
        countsByCategory={countsByCategory}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatus}
      />

      {/* Модалка создания */}
      {modalOpen && (
        <DocumentCreateModal
          form={form}
          contractors={contractors}
          saving={saving}
          error={error}
          activeCategory={category}
          onFormChange={patch => setForm(p => ({ ...p, ...patch }))}
          onSubmit={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Модалка директора — подписание договора */}
      {reviewDeal && (
        <ContractReviewModal
          dealId={reviewDeal.id}
          dealCode={reviewDeal.code}
          clientName={reviewDeal.client_name}
          onClose={() => setReviewDeal(null)}
          onApproved={() => {
            loadPendingDeals();
            setReviewDeal(null);
          }}
        />
      )}
    </div>
  );
}
