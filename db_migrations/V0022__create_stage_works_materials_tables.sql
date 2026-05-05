-- ============================================================
-- Таблица: спецификация работ по этапам (для бригады/строительства)
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.stage_works (
    id                SERIAL PRIMARY KEY,
    serial_project_id INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.serial_projects(id),
    stage_num         INTEGER NOT NULL,
    work_name         VARCHAR(300) NOT NULL,
    unit              VARCHAR(50)  NOT NULL DEFAULT 'шт',
    quantity          NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Таблица: спецификация материалов по этапам (для снабжения)
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.stage_materials (
    id                SERIAL PRIMARY KEY,
    serial_project_id INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.serial_projects(id),
    stage_num         INTEGER NOT NULL,
    material_name     VARCHAR(300) NOT NULL,
    unit              VARCHAR(50)  NOT NULL DEFAULT 'шт',
    quantity          NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0,
    supplier_hint     VARCHAR(200),
    notes             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_works_project    ON t_p60494808_erp_system_creation.stage_works(serial_project_id, stage_num);
CREATE INDEX IF NOT EXISTS idx_stage_materials_project ON t_p60494808_erp_system_creation.stage_materials(serial_project_id, stage_num);

-- Поле для хранения ссылки на слот в сделке (для фильтрации по дате подписания)
ALTER TABLE t_p60494808_erp_system_creation.slots
    ADD COLUMN IF NOT EXISTS deal_id INTEGER;