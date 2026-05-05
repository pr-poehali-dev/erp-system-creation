-- ШАГ 5: Проекты (2 штуки — из сделок со статусом contract)
-- Проект 1 — уже есть id=1, обновляем
UPDATE t_p60494808_erp_system_creation.projects
SET code='ДОМ-0001', deal_id=1, client_id=1,
    address='г. Кстово, ул. Садовая, 14',
    brigade='Бригада №1 (Соколов)',
    start_date='2026-05-01', deadline='2026-07-01',
    status='active', total_cost=0
WHERE id=1;

-- Этапы для ДОМ-0001 — обновляем существующие
UPDATE t_p60494808_erp_system_creation.project_stages
SET name='Фундамент', order_num=1, duration_days=10,
    planned_start='2026-05-01', planned_end='2026-05-10',
    actual_start='2026-05-01', status='done'
WHERE project_id=1 AND id=(SELECT MIN(id) FROM t_p60494808_erp_system_creation.project_stages WHERE project_id=1);

UPDATE t_p60494808_erp_system_creation.project_stages
SET name='Коробка', order_num=2, duration_days=8,
    planned_start='2026-05-11', planned_end='2026-05-18',
    actual_start='2026-05-11', status='active'
WHERE project_id=1 AND id=(
  SELECT id FROM t_p60494808_erp_system_creation.project_stages WHERE project_id=1 ORDER BY id LIMIT 1 OFFSET 1
);

UPDATE t_p60494808_erp_system_creation.project_stages
SET name='Кровля', order_num=3, duration_days=28,
    planned_start='2026-05-19', planned_end='2026-06-15',
    status='pending'
WHERE project_id=1 AND id=(
  SELECT id FROM t_p60494808_erp_system_creation.project_stages WHERE project_id=1 ORDER BY id LIMIT 1 OFFSET 2
);

UPDATE t_p60494808_erp_system_creation.project_stages
SET name='Штукатурка', order_num=4, duration_days=4,
    planned_start='2026-06-16', planned_end='2026-06-19',
    status='pending'
WHERE project_id=1 AND id=(
  SELECT id FROM t_p60494808_erp_system_creation.project_stages WHERE project_id=1 ORDER BY id LIMIT 1 OFFSET 3
);

-- Проект 2 — новый (Петрова С.В.)
INSERT INTO t_p60494808_erp_system_creation.projects
  (code, deal_id, client_id, address, brigade, start_date, deadline, status, total_cost)
VALUES ('ДОМ-0002', NULL, 2,
        'г. Нижний Новгород, ул. Луговая, 7',
        'Бригада №3 (Романов)',
        '2026-06-01', '2026-08-01', 'active', 0);

-- Этапы ДОМ-0002
INSERT INTO t_p60494808_erp_system_creation.project_stages
  (project_id, name, order_num, duration_days, planned_start, planned_end, status)
VALUES
  (2, 'Фундамент',  1, 10, '2026-06-01', '2026-06-10', 'pending'),
  (2, 'Коробка',    2,  8, '2026-06-11', '2026-06-18', 'pending'),
  (2, 'Кровля',     3, 28, '2026-06-19', '2026-07-16', 'pending'),
  (2, 'Штукатурка', 4,  4, '2026-07-17', '2026-07-20', 'pending');