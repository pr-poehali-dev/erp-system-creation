-- Архивируем сделки с устаревшими статусами (negotiation, proposal), 
-- которые не вписываются в текущую воронку lead→kp→planning→closed
-- и висят в активном списке CRM вне колонок.
UPDATE t_p60494808_erp_system_creation.deals
SET is_archived = TRUE, updated_at = now()
WHERE stage IN ('negotiation', 'proposal')
  AND is_archived = FALSE;
