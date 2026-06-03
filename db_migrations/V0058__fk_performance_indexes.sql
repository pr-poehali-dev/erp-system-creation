-- Индексы на внешние ключи, используемые в JOIN, для ускорения выборок
CREATE INDEX IF NOT EXISTS idx_projects_client_id
    ON t_p60494808_erp_system_creation.projects (client_id);

CREATE INDEX IF NOT EXISTS idx_deals_serial_project_id
    ON t_p60494808_erp_system_creation.deals (serial_project_id);

CREATE INDEX IF NOT EXISTS idx_deals_configuration_id
    ON t_p60494808_erp_system_creation.deals (configuration_id);

CREATE INDEX IF NOT EXISTS idx_project_stages_parent_id
    ON t_p60494808_erp_system_creation.project_stages (parent_id);