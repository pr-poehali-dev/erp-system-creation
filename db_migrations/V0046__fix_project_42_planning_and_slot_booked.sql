UPDATE t_p60494808_erp_system_creation.projects
SET status = 'planning', updated_at = now()
WHERE id = 42;

UPDATE t_p60494808_erp_system_creation.slots
SET status = 'booked'
WHERE id = 6;
