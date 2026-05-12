-- V0050: Таблица шаблонов структуры таблиц счетов
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.table_templates (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    headers       JSONB  NOT NULL DEFAULT '[]',        -- ["№","Наименование","Кол-во","Цена","Сумма"]
    column_map    JSONB  NOT NULL DEFAULT '{}',        -- {"material":1,"quantity":3,"unit_price":4,"unit":2}
    ai_suggested  BOOLEAN NOT NULL DEFAULT FALSE,      -- true = предложено AI, не подтверждено человеком
    use_count     INTEGER NOT NULL DEFAULT 0,
    last_used_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);