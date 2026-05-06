-- Обнуление всех тестовых слотов: free + отвязка от сделок
UPDATE t_p60494808_erp_system_creation.slots
SET status = 'free', deal_id = NULL
WHERE status IN ('booked', 'busy');
