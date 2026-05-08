-- Очистка зависших слотов: статус booked/busy, но сделка не существует или удалена
UPDATE t_p60494808_erp_system_creation.slots
SET status = 'free', deal_id = NULL
WHERE status IN ('booked', 'busy')
  AND (
    deal_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM t_p60494808_erp_system_creation.deals d
      WHERE d.id = slots.deal_id AND d.is_archived = FALSE
    )
  );
