-- Таблица нормативов длительности этапов (редактирует только директор)
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.stage_durations (
    stage_num       INTEGER PRIMARY KEY,
    stage_name      VARCHAR(100) NOT NULL,
    duration_days   INTEGER NOT NULL,
    parallel_group  INTEGER,          -- NULL = последовательный, цифра = группа параллельных
    depends_on      INTEGER[],        -- stage_num от которых зависит
    sort_order      INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Заполняем 11 этапов (директор может менять duration_days)
INSERT INTO t_p60494808_erp_system_creation.stage_durations
    (stage_num, stage_name, duration_days, parallel_group, depends_on, sort_order)
VALUES
    (1,  'Подготовка основания', 5,  NULL, '{}',        1),
    (2,  'Фундамент',            10, NULL, '{1}',       2),
    (3,  'Коробка',              8,  NULL, '{2}',       3),
    (4,  'Кровля',               28, 1,   '{3}',       4),
    (5,  'Окна',                 1,  1,   '{3}',       5),
    (6,  'Фасад',                16, 1,   '{3}',       6),
    (7,  'Электрика черновая',   7,  1,   '{3}',       7),
    (8,  'Сантехника черновая',  7,  1,   '{3}',       8),
    (9,  'Штукатурка+стяжка',    4,  NULL, '{4,5,6,7,8}', 9),
    (10, 'Чистовая отделка',     7,  NULL, '{9}',      10),
    (11, 'Отделка финиш',        1,  NULL, '{9}',      11)
ON CONFLICT (stage_num) DO NOTHING;

-- Новые поля в deals: этапы выбранные при КП, дата подписания, буфер дней
ALTER TABLE t_p60494808_erp_system_creation.deals
    ADD COLUMN IF NOT EXISTS selected_stages    INTEGER[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS signed_date        DATE,
    ADD COLUMN IF NOT EXISTS buffer_days        INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN IF NOT EXISTS kp_notes          TEXT,
    ADD COLUMN IF NOT EXISTS address           VARCHAR(300);

-- Обновим поле stage чтобы было понятно допустимые значения (комментарий)
-- Воронка: lead → kp → contract → planning → lost
COMMENT ON COLUMN t_p60494808_erp_system_creation.deals.stage IS
    'lead=новый лид, kp=КП отправлено, contract=договор подписан, planning=планирование производства, lost=отказ';