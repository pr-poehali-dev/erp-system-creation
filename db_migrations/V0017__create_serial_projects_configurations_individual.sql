-- ШАГ 1: Справочник серийных проектов
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.serial_projects (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    area_sqm         NUMERIC(8,1),
    base_price       NUMERIC(14,2) NOT NULL,
    base_duration_days INTEGER NOT NULL DEFAULT 62,
    description      TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ШАГ 2: Справочник комплектаций
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.configurations (
    id                  SERIAL PRIMARY KEY,
    serial_project_id   INTEGER REFERENCES t_p60494808_erp_system_creation.serial_projects(id),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    price_coefficient   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    duration_days       INTEGER NOT NULL DEFAULT 62,
    included_stages     INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11}',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ШАГ 3: Карточки индивидуальных проектов
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.individual_project_requests (
    id                   SERIAL PRIMARY KEY,
    deal_id              INTEGER REFERENCES t_p60494808_erp_system_creation.deals(id),
    client_id            INTEGER REFERENCES t_p60494808_erp_system_creation.clients(id),
    desired_area         NUMERIC(8,1),
    special_requests     TEXT,
    status               VARCHAR(60) NOT NULL DEFAULT 'awaiting_design',
    assigned_designer_id INTEGER REFERENCES t_p60494808_erp_system_creation.staff(id),
    assigned_geologist_id INTEGER REFERENCES t_p60494808_erp_system_creation.staff(id),
    design_deadline      DATE,
    estimate_file_url    TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);