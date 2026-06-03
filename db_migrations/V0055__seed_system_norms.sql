INSERT INTO t_p60494808_erp_system_creation.system_norms (key, value, label) VALUES
    ('k_company_target',    '0.90',     'Целевой коэффициент компании'),
    ('k_company_alert',     '0.80',     'Порог уведомления'),
    ('margin_target',       '35',       'Целевая маржа строительства (%)'),
    ('advance_min_pct',     '30',       'Минимальный аванс по договору (%)'),
    ('warranty_years',      '5',        'Гарантийный срок (лет)'),
    ('warranty_alert_days', '30',       'За сколько дней до конца гарантии напомнить'),
    ('sales_plan_month',    '20000000', 'План продаж в месяц (руб)'),
    ('houses_plan_month',   '4',        'План сдачи домов в месяц')
ON CONFLICT (key) DO NOTHING;