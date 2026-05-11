import Icon from "@/components/ui/icon";
import { PROJECT_STATUS_MAP, PortalTab } from "./portal.shared";

interface Props {
  clientName: string;
  projectStatus: string | null;
  activeTab: PortalTab;
  hasGantt: boolean;
  pendingActsCount: number;
  onChangeTab: (tab: PortalTab) => void;
}

const TABS: { key: PortalTab; label: string; icon: string }[] = [
  { key: "main", label: "Мой дом",    icon: "Home" },
  { key: "plan", label: "План работ", icon: "CalendarCheck" },
];

export default function PortalHeader({
  clientName,
  projectStatus,
  activeTab,
  hasGantt,
  pendingActsCount,
  onChangeTab,
}: Props) {
  const status = projectStatus || "planning";
  const pstatus = PROJECT_STATUS_MAP[status] || PROJECT_STATUS_MAP["planning"];

  const visibleTabs = hasGantt ? TABS : TABS.filter(t => t.key !== "plan");

  return (
    <div className="bg-white border-b border-border sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Личный кабинет клиента</div>
          <div className="font-semibold text-[15px]">{clientName}</div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium ${pstatus.cls}`}>
          <Icon name={pstatus.icon as Parameters<typeof Icon>[0]["name"]} size={13} />
          {pstatus.label}
        </div>
      </div>

      {/* Вкладки — только если есть гант */}
      {visibleTabs.length > 1 && (
        <div className="max-w-2xl mx-auto px-4 flex gap-0 border-t border-border">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              onClick={() => onChangeTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.key === "main" && pendingActsCount > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingActsCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
