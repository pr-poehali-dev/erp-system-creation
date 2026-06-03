INSERT INTO t_p60494808_erp_system_creation.stage_durations
    (stage_num, stage_name, duration_days, parallel_group, depends_on, sort_order) VALUES
    (1,  'Подготовка основания',  5,  NULL, ARRAY[]::int[],   1),
    (2,  'Фундамент',             10, NULL, ARRAY[1],         2),
    (3,  'Коробка',               8,  NULL, ARRAY[2],         3),
    (4,  'Кровля',                28, 1,    ARRAY[3],         4),
    (5,  'Окна черновые',         5,  1,    ARRAY[3],         5),
    (6,  'Фасад',                 16, 1,    ARRAY[3],         6),
    (7,  'Электрика черновая',    7,  1,    ARRAY[3],         7),
    (8,  'Сантехника черновая',   7,  1,    ARRAY[3],         8),
    (9,  'Штукатурка + стяжка',   4,  NULL, ARRAY[4,5,6,7,8], 9),
    (10, 'Чистовая отделка',      60, NULL, ARRAY[9],         10)
ON CONFLICT (stage_num) DO NOTHING;