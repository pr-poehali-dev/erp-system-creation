-- ============================================================
-- Исправляем нормативы длительности этапов
-- Убираем этап 11 путём деактивации, исправляем длительности
-- Тёплый контур: этапы 1-5, параллельные 4+5 → макс=28 → итого 1+10+8+28=47 дней (≈52 с задержками)
-- Предчистовая:  этапы 1-9 → +4 стяжка = 70 дней  
-- Под ключ:      этапы 1-10 → +60 чистовая = 130 дней
-- ============================================================

-- Этап 1: Подготовка основания — 5 дней (заменяем 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 5, stage_name = 'Подготовка основания', depends_on = '{}', parallel_group = NULL
WHERE stage_num = 1;

-- Этап 2: Фундамент — 10 дней
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 10, stage_name = 'Фундамент', depends_on = '{1}', parallel_group = NULL
WHERE stage_num = 2;

-- Этап 3: Коробка — 8 дней
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 8, stage_name = 'Коробка', depends_on = '{2}', parallel_group = NULL
WHERE stage_num = 3;

-- Этап 4: Кровля — 28 дней (параллельная группа 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 28, stage_name = 'Кровля', depends_on = '{3}', parallel_group = 1
WHERE stage_num = 4;

-- Этап 5: Окна черновые — 5 дней (параллельная группа 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 5, stage_name = 'Окна черновые', depends_on = '{3}', parallel_group = 1
WHERE stage_num = 5;

-- Этап 6: Фасад — 16 дней (параллельная группа 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 16, stage_name = 'Фасад', depends_on = '{3}', parallel_group = 1
WHERE stage_num = 6;

-- Этап 7: Электрика черновая — 7 дней (параллельная группа 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 7, stage_name = 'Электрика черновая', depends_on = '{3}', parallel_group = 1
WHERE stage_num = 7;

-- Этап 8: Сантехника черновая — 7 дней (параллельная группа 1)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 7, stage_name = 'Сантехника черновая', depends_on = '{3}', parallel_group = 1
WHERE stage_num = 8;

-- Этап 9: Штукатурка + стяжка — 4 дня (после всех параллельных)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 4, stage_name = 'Штукатурка + стяжка', depends_on = '{4,5,6,7,8}', parallel_group = NULL
WHERE stage_num = 9;

-- Этап 10: Чистовая отделка — 60 дней (после стяжки)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET duration_days = 60, stage_name = 'Чистовая отделка', depends_on = '{9}', parallel_group = NULL
WHERE stage_num = 10;

-- Этап 11: деактивируем (не удаляем — инструмент не позволяет)
UPDATE t_p60494808_erp_system_creation.stage_durations
SET stage_name = '_DISABLED_Отделка финиш', duration_days = 0, sort_order = 99
WHERE stage_num = 11;

-- Обновляем конфигурации — убираем этап 11
-- Тёплый контур = этапы 1-5: 5+10+8+28(макс параллельных)=51 день
UPDATE t_p60494808_erp_system_creation.configurations
SET included_stages = '{1,2,3,4,5}', duration_days = 51, price_coefficient = 0.65
WHERE name = 'Тёплый контур';

-- Предчистовая = этапы 1-9: 51+4=55 дней
UPDATE t_p60494808_erp_system_creation.configurations
SET included_stages = '{1,2,3,4,5,6,7,8,9}', duration_days = 55, price_coefficient = 0.80
WHERE name = 'Предчистовая';

-- Под ключ = этапы 1-10: 55+60=115 дней
UPDATE t_p60494808_erp_system_creation.configurations
SET included_stages = '{1,2,3,4,5,6,7,8,9,10}', duration_days = 115, price_coefficient = 1.0
WHERE name = 'Под ключ';