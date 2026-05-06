-- Разрешаем статус 'archived' для слотов
-- (статус already stored as varchar(30), просто нужно убедиться что нет CHECK constraint)
-- Добавляем индекс для ускорения проверки двойного бронирования
CREATE INDEX IF NOT EXISTS idx_slots_status ON t_p60494808_erp_system_creation.slots(status);
CREATE INDEX IF NOT EXISTS idx_slots_deal_id ON t_p60494808_erp_system_creation.slots(deal_id);
CREATE INDEX IF NOT EXISTS idx_projects_slot_id ON t_p60494808_erp_system_creation.projects(slot_id);
CREATE INDEX IF NOT EXISTS idx_projects_deal_id ON t_p60494808_erp_system_creation.projects(deal_id);
