-- Чистим зависший тестовый слот от несуществующей сделки id=49
UPDATE t_p60494808_erp_system_creation.slots
SET status = 'free', deal_id = NULL
WHERE id = 4 AND deal_id = 49;
