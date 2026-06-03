import { Invoice } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { STATUS_CFG, fmtMoney } from "./invoices.shared";

interface Props {
  filterSt: Invoice["recognition_status"] | "";
  setFilterSt: (v: Invoice["recognition_status"] | "") => void;
  totalSum: number;
  canUseAI: boolean;
  onBulkOpen: () => void;
  onCreate: () => void;
}

export default function InvoicesToolbar({
  filterSt, setFilterSt, totalSum, canUseAI, onBulkOpen, onCreate,
}: Props) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterSt} onChange={e => setFilterSt(e.target.value as Invoice["recognition_status"] | "")}
          className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="text-[13px] text-muted-foreground">
          Итого: <span className="font-semibold text-foreground">{fmtMoney(totalSum)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canUseAI && (
          <button onClick={onBulkOpen}
            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[13px] font-medium hover:bg-secondary transition-colors">
            <Icon name="Files" size={14} />
            Загрузить несколько
          </button>
        )}
        <button onClick={onCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить счёт
        </button>
      </div>
    </div>
  );
}
