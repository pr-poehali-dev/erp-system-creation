-- Отвязываем архивные и завершённые проекты от слотов
-- Слот уже free — проект просто ссылается на него без нужды
UPDATE t_p60494808_erp_system_creation.projects
SET slot_id = NULL
WHERE slot_id IS NOT NULL
  AND status IN ('archived', 'completed');

-- Дополнительно: слоты с booked/busy без реальной активной сделки → free
UPDATE t_p60494808_erp_system_creation.slots s
SET status = 'free', deal_id = NULL
WHERE s.status IN ('booked', 'busy')
  AND (
    s.deal_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM t_p60494808_erp_system_creation.deals d
      WHERE d.id = s.deal_id AND d.is_archived = FALSE
    )
  );
