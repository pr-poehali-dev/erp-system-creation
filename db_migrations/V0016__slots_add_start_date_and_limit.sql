-- Добавляем поля в slots: дата начала слота и лимит на месяц
ALTER TABLE t_p60494808_erp_system_creation.slots
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS monthly_limit integer NOT NULL DEFAULT 4;

-- Проставляем start_date для существующих слотов (равномерно по неделям)
-- Май 2026
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-05-01', monthly_limit = 4 WHERE id = 1;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-05-08', monthly_limit = 4 WHERE id = 2;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-05-15', monthly_limit = 4 WHERE id = 3;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-05-22', monthly_limit = 4 WHERE id = 4;

-- Июнь 2026
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-06-01', monthly_limit = 4 WHERE id = 5;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-06-08', monthly_limit = 4 WHERE id = 6;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-06-15', monthly_limit = 4 WHERE id = 7;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-06-22', monthly_limit = 4 WHERE id = 8;

-- Июль 2026
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-07-01', monthly_limit = 4 WHERE id = 9;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-07-08', monthly_limit = 4 WHERE id = 10;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-07-15', monthly_limit = 4 WHERE id = 11;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-07-22', monthly_limit = 4 WHERE id = 12;

-- Август 2026
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-08-01', monthly_limit = 4 WHERE id = 13;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-08-08', monthly_limit = 4 WHERE id = 14;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-08-15', monthly_limit = 4 WHERE id = 15;
UPDATE t_p60494808_erp_system_creation.slots SET start_date = '2026-08-22', monthly_limit = 4 WHERE id = 16;

-- Добавляем слоты на сентябрь 2026
INSERT INTO t_p60494808_erp_system_creation.slots (year, month, start_date, status, monthly_limit) VALUES
  (2026, 9, '2026-09-01', 'free', 4),
  (2026, 9, '2026-09-08', 'free', 4),
  (2026, 9, '2026-09-15', 'free', 4),
  (2026, 9, '2026-09-22', 'free', 4);