import { useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import AdminSlotPlan from "@/components/admin/AdminSlotPlan";
import AdminDocTemplates from "@/components/admin/AdminDocTemplates";
import AdminStageDurations from "@/components/admin/AdminStageDurations";
import AdminIntegrationsPanel from "@/components/admin/AdminIntegrationsPanel";
import AdminDiscounts from "@/components/admin/AdminDiscounts";

interface Props { role: Role; }

// Аккордеон-секция
function Section({ title, icon, defaultOpen = false, children }: {
  title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={16} className="text-primary" />
          <span className="font-semibold text-[14px]">{title}</span>
        </div>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

export default function Admin({ role }: Props) {
  const canView = role === "director" || role === "construction_director";

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Icon name="Lock" size={40} className="text-muted-foreground mb-4" />
        <div className="text-[18px] font-semibold text-foreground">Доступ закрыт</div>
        <div className="text-hint mt-2">Этот раздел доступен только Генеральному директору и Директору по строительству</div>
      </div>
    );
  }

  const isDirector = role === "director";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold">Администрирование</h1>
        <p className="text-hint mt-0.5">
          {isDirector ? "Производство, продажи, документы — всё под контролем" : "Слот-план производства (просмотр)"}
        </p>
      </div>

      {/* ═══ ПРОИЗВОДСТВО ════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-5 bg-blue-500 rounded-full" />
          <span className="text-[13px] font-bold text-foreground uppercase tracking-wide">Производство</span>
        </div>

        <Section title="Слот-план производства" icon="CalendarCheck" defaultOpen={true}>
          <AdminSlotPlan readonly={!isDirector} />
        </Section>

        {isDirector && (
          <Section title="Нормативы этапов (сроки)" icon="Clock">
            <AdminStageDurations />
          </Section>
        )}
      </div>

      {/* ═══ ПРОДАЖИ ═════════════════════════════════════════════════════════ */}
      {isDirector && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            <span className="text-[13px] font-bold text-foreground uppercase tracking-wide">Продажи и КП</span>
          </div>

          <Section title="Скидки и популярные комплектации" icon="Tag">
            <AdminDiscounts />
          </Section>

          <Section title="Пакет документов при подписании договора" icon="FolderOpen">
            <AdminDocTemplates />
          </Section>
        </div>
      )}

      {/* ═══ СИСТЕМА ══════════════════════════════════════════════════════════ */}
      {isDirector && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-5 bg-violet-500 rounded-full" />
            <span className="text-[13px] font-bold text-foreground uppercase tracking-wide">Система и интеграции</span>
          </div>

          <Section title="Интеграции и автоматизация" icon="Zap">
            <AdminIntegrationsPanel />
          </Section>
        </div>
      )}
    </div>
  );
}
