-- ===== Пункт 1: Очистка тестовых данных риэлтора =====

-- 1. Освобождаем слоты, привязанные к сделкам риэлтора
UPDATE t_p60494808_erp_system_creation.slots
SET status = 'free', deal_id = NULL
WHERE id IN (1, 4, 6, 9)
  AND status IN ('booked', 'busy');

-- 2. Обнуляем данные в сделках риэлтора (budget, commission, stage → archived)
UPDATE t_p60494808_erp_system_creation.deals
SET
    is_archived       = TRUE,
    budget            = NULL,
    commission_amount = NULL,
    commission_rate   = NULL,
    closed_at         = NULL,
    slot_id           = NULL,
    kp_slot_id        = NULL,
    stage             = 'lost'
WHERE realtor_id IS NOT NULL;

-- 3. Обнуляем счётчики и сбрасываем квалификацию риэлтора
UPDATE t_p60494808_erp_system_creation.staff
SET
    closed_deals_count = 0,
    qualification      = 'novice'
WHERE role = 'realtor';
