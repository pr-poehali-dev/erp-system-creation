-- Критичные индексы для часто фильтруемых полей.
-- Без них на росте сделок до тысяч — будет полный скан таблицы.

-- DEALS: фильтрация по менеджеру/риэлтору, по стадии, по архиву
CREATE INDEX IF NOT EXISTS idx_deals_manager_id   ON t_p60494808_erp_system_creation.deals(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_realtor_id   ON t_p60494808_erp_system_creation.deals(realtor_id) WHERE realtor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_stage        ON t_p60494808_erp_system_creation.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_is_archived  ON t_p60494808_erp_system_creation.deals(is_archived);
CREATE INDEX IF NOT EXISTS idx_deals_client_id    ON t_p60494808_erp_system_creation.deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_active       ON t_p60494808_erp_system_creation.deals(stage, is_archived);

-- PAYMENTS: фильтрация по проекту/сделке, по типу
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON t_p60494808_erp_system_creation.payments(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deal_id    ON t_p60494808_erp_system_creation.payments(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_type       ON t_p60494808_erp_system_creation.payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_date       ON t_p60494808_erp_system_creation.payments(payment_date DESC);

-- MATERIAL_REQUESTS
CREATE INDEX IF NOT EXISTS idx_mr_status      ON t_p60494808_erp_system_creation.material_requests(status);
CREATE INDEX IF NOT EXISTS idx_mr_foreman_id  ON t_p60494808_erp_system_creation.material_requests(foreman_id) WHERE foreman_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mr_project_id  ON t_p60494808_erp_system_creation.material_requests(project_id) WHERE project_id IS NOT NULL;

-- CLIENT_ACTS
CREATE INDEX IF NOT EXISTS idx_acts_project_id ON t_p60494808_erp_system_creation.client_acts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acts_stage_id   ON t_p60494808_erp_system_creation.client_acts(stage_id) WHERE stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acts_status     ON t_p60494808_erp_system_creation.client_acts(status);

-- NOTIFICATIONS: запросы по непрочитанным/по дате
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON t_p60494808_erp_system_creation.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread     ON t_p60494808_erp_system_creation.notifications(is_read, created_at DESC) WHERE is_read = FALSE;

-- PROJECTS: status (для фильтрации active/archived/completed)
CREATE INDEX IF NOT EXISTS idx_projects_status ON t_p60494808_erp_system_creation.projects(status);

-- PROJECT_STAGES
CREATE INDEX IF NOT EXISTS idx_pstages_project_id ON t_p60494808_erp_system_creation.project_stages(project_id);
