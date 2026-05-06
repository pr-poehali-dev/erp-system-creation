-- Добавляем slot_id в projects (связь проекта со слотом)
ALTER TABLE t_p60494808_erp_system_creation.projects
  ADD COLUMN IF NOT EXISTS slot_id integer REFERENCES t_p60494808_erp_system_creation.slots(id);

-- Связываем существующие проекты со слотами через deal_id
UPDATE t_p60494808_erp_system_creation.projects p
SET slot_id = s.id
FROM t_p60494808_erp_system_creation.slots s
WHERE s.deal_id = p.deal_id
  AND p.slot_id IS NULL;
