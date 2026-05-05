import Icon from "@/components/ui/icon";

const integrations = [
  { name: "МойСклад", desc: "Синхронизация остатков, цен, поступлений", status: "active", lastSync: "сегодня 08:03" },
  { name: "Telegram-бот (ОТК)", desc: "Приёмка этапов, фото дефектов, уведомления прорабу", status: "active", lastSync: "сегодня 07:51" },
  { name: "SMS-шлюз", desc: "Отправка ID-ключа клиентам при регистрации в ЛК", status: "active", lastSync: "вчера 14:22" },
  { name: "Почтовый сервер (SMTP)", desc: "Договоры, счета, уведомления клиентам", status: "active", lastSync: "сегодня 06:00" },
  { name: "1С (интеграция)", desc: "Импорт/экспорт платежей и проводок", status: "pending", lastSync: "Не настроено (Этап 2)" },
];

const automations = [
  { trigger: "Подписание договора", action: "Создать проект ДОМ-XXXX + занять слот + развернуть 11 этапов (по комплектации)", status: "active" },
  { trigger: "Индивидуальный проект", action: "Создать карточку проектирования, слот не занимать", status: "active" },
  { trigger: "Отклонение чек-листа в Telegram", action: "Создать задачу прорабу с фото дефекта", status: "active" },
  { trigger: "Заявка на материал (срочно)", action: "Отправить push-уведомление снабженцу", status: "active" },
  { trigger: "Завершение этапа строительства", action: "Уведомление клиенту в ЛК", status: "active" },
  { trigger: "Ежедневно в 08:00", action: "Пересчёт K_company (с учётом норматива комплектации)", status: "active" },
  { trigger: "За 30 дней до конца гарантии", action: "Email клиенту с предложением продления", status: "active" },
];

const norms = [
  { param: "Нормативный срок (Под ключ)", value: "62 дня" },
  { param: "Нормативный срок (Предчистовая)", value: "50 дней" },
  { param: "Нормативный срок (Тёплый контур)", value: "40 дней" },
  { param: "Целевой K_company", value: "0.90" },
  { param: "Целевая маржа строительства", value: "35%" },
  { param: "Минимальный аванс по договору", value: "30%" },
  { param: "Гарантийный срок (лет)", value: "5 лет" },
  { param: "Период рассылки «продление гарантии»", value: "30 дней до окончания" },
];

export default function AdminIntegrationsPanel() {
  return (
    <>
      {/* Integrations */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Интеграции</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={13} />
            Добавить
          </button>
        </div>
        <div className="divide-y divide-border">
          {integrations.map(int => (
            <div key={int.name} className="px-5 py-4 flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${int.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{int.name}</div>
                <div className="text-hint">{int.desc}</div>
              </div>
              <div className="text-right">
                <div className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${int.status === "active" ? "badge-success" : "badge-warning"}`}>
                  {int.status === "active" ? "Активна" : "Не настроено"}
                </div>
                <div className="text-hint mt-1">Синхронизация: {int.lastSync}</div>
              </div>
              <button className="text-muted-foreground hover:text-primary transition-colors ml-2">
                <Icon name="Settings" size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Automations */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Автоматизации</h2>
        </div>
        <div className="divide-y divide-border">
          {automations.map((a, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <Icon name="Zap" size={14} className="text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="text-[13px] font-medium text-foreground">{a.trigger}</span>
                <span className="text-hint mx-2">→</span>
                <span className="text-[13px] text-muted-foreground">{a.action}</span>
              </div>
              <div className={`w-8 h-4 rounded-full ${a.status === "active" ? "bg-emerald-500" : "bg-gray-300"} flex items-center ${a.status === "active" ? "justify-end pr-0.5" : "justify-start pl-0.5"}`}>
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Norms */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Нормативы и параметры системы</h2>
        </div>
        <div className="divide-y divide-border">
          {norms.map((n, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 text-[13px] text-muted-foreground">{n.param}</div>
              <div className="text-[13px] font-semibold text-foreground">{n.value}</div>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <Icon name="Edit2" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
