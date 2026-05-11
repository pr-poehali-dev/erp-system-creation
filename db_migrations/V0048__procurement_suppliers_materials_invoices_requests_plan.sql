-- ─── Поставщики ───────────────────────────────────────────────
CREATE TABLE t_p60494808_erp_system_creation.suppliers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    inn         VARCHAR(20),
    category    VARCHAR(50) NOT NULL DEFAULT 'прочее'
                CHECK (category IN ('бетон','пиломатериалы','металл','кровля','инженерия','отделка','прочее')),
    contact     VARCHAR(200),
    rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Материалы ─────────────────────────────────────────────────
CREATE TABLE t_p60494808_erp_system_creation.materials (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    unit             VARCHAR(20)  NOT NULL DEFAULT 'шт'
                     CHECK (unit IN ('шт','м3','т','пог.м','м2','компл')),
    supplier_category VARCHAR(50)
                     CHECK (supplier_category IS NULL OR supplier_category IN
                            ('бетон','пиломатериалы','металл','кровля','инженерия','отделка','прочее')),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (name, unit)
);

-- ─── Счета ─────────────────────────────────────────────────────
CREATE TABLE t_p60494808_erp_system_creation.invoices (
    id                  SERIAL PRIMARY KEY,
    supplier_id         INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.suppliers(id),
    material_id         INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.materials(id),
    invoice_date        DATE,
    invoice_number      VARCHAR(100),
    unit_price          NUMERIC(14,2),
    quantity            NUMERIC(14,3),
    total_amount        NUMERIC(14,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    pdf_file_url        TEXT,
    pdf_file_name       VARCHAR(300),
    recognition_status  VARCHAR(30) NOT NULL DEFAULT 'новый'
                        CHECK (recognition_status IN ('новый','обработан','требуется_проверка')),
    recognized_data     TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── Заявки на закупку ─────────────────────────────────────────
CREATE TABLE t_p60494808_erp_system_creation.purchase_requests (
    id              SERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT now(),
    staff_id        INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.staff(id),
    material_id     INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.materials(id),
    quantity        NUMERIC(14,3) NOT NULL,
    needed_by       DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'новая'
                    CHECK (status IN ('новая','в_работе','закрыта')),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Связь многие-ко-многим: заявки ↔ поставщики
CREATE TABLE t_p60494808_erp_system_creation.purchase_request_suppliers (
    request_id  INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.purchase_requests(id),
    supplier_id INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.suppliers(id),
    PRIMARY KEY (request_id, supplier_id)
);

-- ─── Плановые закупки ──────────────────────────────────────────
CREATE TABLE t_p60494808_erp_system_creation.purchase_plan (
    id              SERIAL PRIMARY KEY,
    material_id     INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.materials(id),
    planned_volume  NUMERIC(14,3) NOT NULL,
    period          VARCHAR(10) NOT NULL DEFAULT 'месяц'
                    CHECK (period IN ('неделя','месяц')),
    period_start    DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Индексы
CREATE INDEX ON t_p60494808_erp_system_creation.suppliers(category);
CREATE INDEX ON t_p60494808_erp_system_creation.materials(supplier_category);
CREATE INDEX ON t_p60494808_erp_system_creation.invoices(supplier_id);
CREATE INDEX ON t_p60494808_erp_system_creation.invoices(material_id);
CREATE INDEX ON t_p60494808_erp_system_creation.purchase_requests(staff_id);
CREATE INDEX ON t_p60494808_erp_system_creation.purchase_requests(material_id);
CREATE INDEX ON t_p60494808_erp_system_creation.purchase_requests(status);
