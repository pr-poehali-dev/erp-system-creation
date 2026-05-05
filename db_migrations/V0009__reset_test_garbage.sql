-- ШАГ 1: Сбрасываем мусорные тестовые данные
UPDATE t_p60494808_erp_system_creation.slots SET status = 'free', deal_id = NULL;
UPDATE t_p60494808_erp_system_creation.project_stages SET status = 'pending' WHERE project_id = 1;
UPDATE t_p60494808_erp_system_creation.projects SET status = 'active', brigade = NULL WHERE id = 1;
UPDATE t_p60494808_erp_system_creation.deals SET stage = 'new', budget = 6500000, client_id = 1, manager_id = 1 WHERE id = 1;
UPDATE t_p60494808_erp_system_creation.k_company_log SET alert_sent = false WHERE id = 1;