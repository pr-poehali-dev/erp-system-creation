export const CATEGORIES = [
  { key: "",           label: "Все",          icon: "Files" },
  { key: "deal",       label: "Сделки",       icon: "PenLine" },
  { key: "supply",     label: "Поставщики",   icon: "Package" },
  { key: "contractor", label: "Подрядчики",   icon: "Hammer" },
  { key: "internal",   label: "Внутренние",   icon: "Shield" },
  { key: "general",    label: "Компания",     icon: "Globe" },
];

export const DOC_TYPES_BY_CATEGORY: Record<string, { key: string; label: string }[]> = {
  deal:       [
    { key: "deal_kp",         label: "КП" },
    { key: "deal_contract",   label: "Договор подряда" },
    { key: "deal_act",        label: "Акт приёмки" },
    { key: "deal_supplement", label: "Доп. соглашение" },
  ],
  supply:     [
    { key: "supply_contract",    label: "Договор поставки" },
    { key: "supply_invoice",     label: "Счёт" },
    { key: "supply_upd",         label: "УПД" },
    { key: "supply_waybill",     label: "Товарная накладная" },
    { key: "supply_certificate", label: "Сертификат" },
  ],
  contractor: [
    { key: "contractor_contract", label: "Договор подряда" },
    { key: "ks2",                 label: "Акт КС-2" },
    { key: "ks3",                 label: "Справка КС-3" },
    { key: "contractor_invoice",  label: "Счёт" },
    { key: "contractor_estimate", label: "Смета" },
  ],
  internal:   [
    { key: "internal_regulation", label: "Регламент" },
    { key: "internal_order",      label: "Приказ" },
    { key: "internal_hr",         label: "Должностная инструкция" },
  ],
  general:    [
    { key: "company_license",     label: "Лицензия" },
    { key: "company_certificate", label: "Сертификат компании" },
    { key: "company_permit",      label: "Разрешение" },
  ],
};

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Черновик",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  sent:      { label: "Отправлен", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  signed:    { label: "Подписан",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paid:      { label: "Оплачен",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Отменён",   cls: "bg-red-50 text-red-600 border-red-200" },
  active:    { label: "Действует", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

export const CATEGORY_COLOR: Record<string, string> = {
  deal:       "bg-blue-50 text-blue-700",
  supply:     "bg-amber-50 text-amber-700",
  contractor: "bg-violet-50 text-violet-700",
  internal:   "bg-emerald-50 text-emerald-700",
  general:    "bg-gray-100 text-gray-600",
};

export function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const fmtRub = (n: number | null) => n ? `₽ ${n.toLocaleString("ru")}` : "—";
