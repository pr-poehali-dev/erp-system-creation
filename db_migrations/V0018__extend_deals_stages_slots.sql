-- Расширяем таблицу deals: тип проекта, серийный проект, комплектация, плановая дата
ALTER TABLE t_p60494808_erp_system_creation.deals
    ADD COLUMN IF NOT EXISTS project_type        VARCHAR(20) NOT NULL DEFAULT 'serial',
    ADD COLUMN IF NOT EXISTS serial_project_id   INTEGER REFERENCES t_p60494808_erp_system_creation.serial_projects(id),
    ADD COLUMN IF NOT EXISTS configuration_id    INTEGER REFERENCES t_p60494808_erp_system_creation.configurations(id),
    ADD COLUMN IF NOT EXISTS planned_start_date  DATE;

-- Расширяем project_stages: параллельность, шаблонный номер этапа
ALTER TABLE t_p60494808_erp_system_creation.project_stages
    ADD COLUMN IF NOT EXISTS stage_num      INTEGER,
    ADD COLUMN IF NOT EXISTS parallel_group INTEGER,
    ADD COLUMN IF NOT EXISTS depends_on     INTEGER[];

-- Расширяем slots: monthly_limit уже есть, добавим capacity_label
ALTER TABLE t_p60494808_erp_system_creation.slots
    ADD COLUMN IF NOT EXISTS capacity_note VARCHAR(200);