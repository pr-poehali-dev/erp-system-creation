-- ============================================================
-- Шаблоны документов (управляет директор)
-- Пакет документов для подписания договора
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.doc_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,          -- "Договор подряда", "Гарантийные обязательства"
    description     TEXT,                           -- Пояснение для менеджера
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,  -- Обязательный или нет
    sort_order      INTEGER NOT NULL DEFAULT 0,
    -- Текущий актуальный шаблон (файл в S3)
    file_url        VARCHAR(1000),                  -- CDN-ссылка для скачивания
    file_name       VARCHAR(500),
    file_size_kb    INTEGER,
    file_updated_at TIMESTAMPTZ,
    -- Управление
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Документы загруженные менеджером по сделке
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.contract_documents (
    id              SERIAL PRIMARY KEY,
    deal_id         INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.deals(id),
    template_id     INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.doc_templates(id),
    -- Загруженный файл (подписанный скан)
    file_url        VARCHAR(1000),
    file_name       VARCHAR(500),
    file_size_kb    INTEGER,
    uploaded_at     TIMESTAMPTZ,
    -- Статус
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending | uploaded | approved
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(deal_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_docs_deal ON t_p60494808_erp_system_creation.contract_documents(deal_id);

-- ============================================================
-- Начальный пакет документов (директор потом меняет файлы)
-- ============================================================
INSERT INTO t_p60494808_erp_system_creation.doc_templates
    (name, description, is_required, sort_order)
VALUES
    ('Договор подряда',
     'Основной договор строительного подряда. Подписывается клиентом и директором.',
     TRUE, 1),
    ('Гарантийные обязательства',
     'Документ с гарантийными сроками и условиями по всем видам работ.',
     TRUE, 2),
    ('Инструкция по эксплуатации дома',
     'Руководство по обслуживанию дома, регламент ТО, контакты сервиса.',
     FALSE, 3)
ON CONFLICT DO NOTHING;