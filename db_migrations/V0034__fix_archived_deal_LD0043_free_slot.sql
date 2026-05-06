-- Исправляем зависший слот от архивной сделки ЛД-0043
UPDATE t_p60494808_erp_system_creation.slots
SET status = 'free', deal_id = NULL
WHERE id = 4 AND status IN ('booked', 'busy');

-- Обнуляем slot_id у архивной сделки
UPDATE t_p60494808_erp_system_creation.deals
SET slot_id = NULL
WHERE id = 45 AND is_archived = TRUE;
