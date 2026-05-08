-- Добавляем поле reject_reason в deals для быстрого доступа к причине отклонения
ALTER TABLE t_p60494808_erp_system_creation.deals
  ADD COLUMN IF NOT EXISTS last_reject_reason TEXT;
