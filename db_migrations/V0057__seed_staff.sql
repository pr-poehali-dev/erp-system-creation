INSERT INTO t_p60494808_erp_system_creation.staff (name, role, dept, is_active)
SELECT v.nm, v.rl, v.dp, TRUE FROM (VALUES
    ('Генеральный директор',      'director',              'Руководство'),
    ('Коммерческий директор',     'commercial',            'Продажи'),
    ('Директор по строительству', 'construction_director', 'Строительство'),
    ('Директор по снабжению',     'supply_director',       'Снабжение'),
    ('Финансовый директор',       'finance_director',      'Финансы'),
    ('Менеджер по продажам',      'crm_manager',           'Продажи'),
    ('Риэлтор',                   'realtor',               'Продажи'),
    ('Прораб',                    'foreman',               'Строительство'),
    ('Снабженец',                 'supplier',              'Снабжение'),
    ('Бухгалтер',                 'accountant',            'Финансы'),
    ('Контролёр качества',        'quality',               'Качество'),
    ('Механик',                   'mechanic',              'Техника')
) AS v(nm, rl, dp)
WHERE NOT EXISTS (SELECT 1 FROM t_p60494808_erp_system_creation.staff);