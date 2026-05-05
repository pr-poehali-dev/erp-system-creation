-- ============================================================
-- Таблица контрагентов (единый справочник)
-- Типы: supplier=Поставщик, contractor=Подрядчик, subcontractor=Субподрядчик,
--       client=Заказчик/Клиент, internal=Внутренний, general=Общий
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.contractors (
    id              SERIAL PRIMARY KEY,
    contractor_type VARCHAR(30)  NOT NULL DEFAULT 'client',
    -- client | supplier | contractor | subcontractor | internal | general
    name            VARCHAR(300) NOT NULL,
    inn             VARCHAR(20),
    kpp             VARCHAR(20),
    legal_address   VARCHAR(500),
    actual_address  VARCHAR(500),
    phone           VARCHAR(50),
    email           VARCHAR(200),
    contact_person  VARCHAR(200),
    bank_name       VARCHAR(300),
    bank_account    VARCHAR(30),
    bik             VARCHAR(15),
    corr_account    VARCHAR(30),
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractors_type   ON t_p60494808_erp_system_creation.contractors(contractor_type);
CREATE INDEX IF NOT EXISTS idx_contractors_name   ON t_p60494808_erp_system_creation.contractors(name);

-- Привязка существующих клиентов к contractors (через deals)
-- clients остаётся для совместимости, contractor_id — новая ссылка
ALTER TABLE t_p60494808_erp_system_creation.deals
    ADD COLUMN IF NOT EXISTS contractor_id INTEGER REFERENCES t_p60494808_erp_system_creation.contractors(id);

-- ============================================================
-- Таблица документов (единый архив по всем типам)
-- Категории по типу контрагента:
--   deal_contract, deal_kp, deal_act — по сделкам (автоматически)
--   supply_contract, supply_invoice, supply_upd, supply_certificate — поставщики
--   contractor_contract, ks2, ks3, contractor_invoice — подрядчики
--   company_license, company_certificate, company_permit — общие
--   internal_regulation, internal_order, internal_hr — внутренние
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.documents (
    id              SERIAL PRIMARY KEY,
    doc_type        VARCHAR(50)  NOT NULL,
    -- Категория: deal | supply | contractor | internal | general
    category        VARCHAR(30)  NOT NULL DEFAULT 'deal',
    title           VARCHAR(500) NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'draft',
    -- draft | sent | signed | paid | cancelled | active
    amount          NUMERIC(14,2),
    doc_date        DATE,
    -- Связи (необязательные)
    deal_id         INTEGER REFERENCES t_p60494808_erp_system_creation.deals(id),
    project_id      INTEGER REFERENCES t_p60494808_erp_system_creation.projects(id),
    contractor_id   INTEGER REFERENCES t_p60494808_erp_system_creation.contractors(id),
    -- Файл
    file_url        VARCHAR(1000),
    file_name       VARCHAR(500),
    file_size_kb    INTEGER,
    -- Метаданные
    notes           TEXT,
    created_by      INTEGER REFERENCES t_p60494808_erp_system_creation.staff(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_category    ON t_p60494808_erp_system_creation.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_deal        ON t_p60494808_erp_system_creation.documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_project     ON t_p60494808_erp_system_creation.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_contractor  ON t_p60494808_erp_system_creation.documents(contractor_id);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON t_p60494808_erp_system_creation.documents(status);

-- ============================================================
-- Засеиваем несколько тестовых контрагентов
-- ============================================================
INSERT INTO t_p60494808_erp_system_creation.contractors
    (contractor_type, name, phone, email, contact_person)
VALUES
    ('supplier',    'ООО СтройМатериал',       '+7 900 111-22-33', 'info@stroymaterial.ru', 'Петров И.В.'),
    ('supplier',    'ИП Кузнецов А.Н.',         '+7 900 222-33-44', 'kuznetsov@mail.ru',    'Кузнецов А.Н.'),
    ('contractor',  'Бригада Северная',         '+7 900 333-44-55', '',                      'Иванов П.С.'),
    ('contractor',  'ООО СтройПрофи',           '+7 900 444-55-66', 'info@stroiprofi.ru',   'Сидоров В.В.'),
    ('subcontractor','ИП Фасадник',             '+7 900 555-66-77', '',                      'Коновалов Р.Т.'),
    ('internal',    'Глобал Строй (внутр.)',    '',                 'info@globalstroy.ru',   'HR отдел'),
    ('general',     'Росреестр',                '',                 '',                      '')
ON CONFLICT DO NOTHING;