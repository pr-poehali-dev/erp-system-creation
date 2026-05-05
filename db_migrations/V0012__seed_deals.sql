-- ШАГ 4: 5 сделок — разные этапы и клиенты
-- Сделка 1 (уже есть id=1): обновляем под реальные данные
UPDATE t_p60494808_erp_system_creation.deals
SET code='ЛД-0001', client_id=1, manager_id=1, realtor_id=6,
    source='Авито', budget=6500000, start_date='2026-05-01',
    notes='Дом К-150, участок в Кстово', stage='contract',
    slot_id=1, project_id=1
WHERE id=1;

UPDATE t_p60494808_erp_system_creation.slots SET status='busy', deal_id=1 WHERE id=1;

-- Сделка 2
INSERT INTO t_p60494808_erp_system_creation.deals
  (code, client_id, manager_id, realtor_id, source, budget, start_date, notes, slot_id, stage)
VALUES ('ЛД-0002', 2, 2, NULL, 'Сайт', 8500000, '2026-06-01',
        'Дом К-200, Нижний Новгород', 5, 'negotiation');
UPDATE t_p60494808_erp_system_creation.slots SET status='booked', deal_id=2 WHERE id=5;

-- Сделка 3
INSERT INTO t_p60494808_erp_system_creation.deals
  (code, client_id, manager_id, source, budget, start_date, notes, slot_id, stage)
VALUES ('ЛД-0003', 3, 1, 'Инстаграм', 7200000, '2026-06-15',
        'Дом К-150, Богородск', 6, 'proposal');
UPDATE t_p60494808_erp_system_creation.slots SET status='booked', deal_id=3 WHERE id=6;

-- Сделка 4
INSERT INTO t_p60494808_erp_system_creation.deals
  (code, client_id, manager_id, source, budget, start_date, notes, slot_id, stage)
VALUES ('ЛД-0004', 6, 2, 'Рекомендация', 4900000, '2026-07-01',
        'Дом Т-100, Дзержинск', 9, 'qualification');
UPDATE t_p60494808_erp_system_creation.slots SET status='booked', deal_id=4 WHERE id=9;

-- Сделка 5
INSERT INTO t_p60494808_erp_system_creation.deals
  (code, client_id, manager_id, source, budget, start_date, notes, slot_id, stage)
VALUES ('ЛД-0005', 5, 1, 'Сайт', 6500000, '2026-07-15',
        'Дом К-150, Кстово — повторный клиент', 10, 'new');
UPDATE t_p60494808_erp_system_creation.slots SET status='booked', deal_id=5 WHERE id=10;