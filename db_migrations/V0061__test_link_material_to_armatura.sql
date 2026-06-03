-- Тест: привязка материала "Арматура А500С d10" к категории "Арматура рифленная"
UPDATE t_p60494808_erp_system_creation.materials
SET category_id = 2, updated_at = now()
WHERE id = 27;