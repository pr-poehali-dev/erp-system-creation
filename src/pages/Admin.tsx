import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import AdminSlotPlan from "@/components/admin/AdminSlotPlan";
import AdminDocTemplates from "@/components/admin/AdminDocTemplates";
import AdminStageDurations from "@/components/admin/AdminStageDurations";
import AdminIntegrationsPanel from "@/components/admin/AdminIntegrationsPanel";

interface Props { role: Role; }

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
          {isDirector ? "Интеграции, нормативы, автоматизация, слот-план" : "Слот-план производства (только просмотр)"}
        </p>
      </div>

      {/* Слот-план — доступен и директору и директору по строительству */}
      <AdminSlotPlan readonly={!isDirector} />

      {/* Только директор */}
      {isDirector && (
        <>
          {/* Пакет документов при подписании */}
          <AdminDocTemplates />

          {/* Нормативы этапов */}
          <AdminStageDurations />

          {/* Интеграции, автоматизации, нормативы системы */}
          <AdminIntegrationsPanel />
        </>
      )}
    </div>
  );
}
