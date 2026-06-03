-- Индексы для ускорения таблицы счетов при больших объёмах (1000+ записей)
-- и операции ретроспективного назначения категорий.

-- JOIN счетов с материалами и подсчёт использований материала.
CREATE INDEX IF NOT EXISTS idx_invoices_material_id
  ON t_p60494808_erp_system_creation.invoices (material_id);

-- ORDER BY i.created_at DESC LIMIT N в get_invoices.
CREATE INDEX IF NOT EXISTS idx_invoices_created_at
  ON t_p60494808_erp_system_creation.invoices (created_at DESC);

-- Фильтрация и JOIN материалов по категории.
CREATE INDEX IF NOT EXISTS idx_materials_category_id
  ON t_p60494808_erp_system_creation.materials (category_id);
