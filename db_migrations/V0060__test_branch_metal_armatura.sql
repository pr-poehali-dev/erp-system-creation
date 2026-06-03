-- Минимальная проверочная ветка дерева для теста фильтрации (если дерево ещё не импортировано).
-- Идемпотентно через ON CONFLICT DO NOTHING по (parent_id, lower(name)).
WITH ins_root AS (
    INSERT INTO t_p60494808_erp_system_creation.material_categories (name, parent_id, sort_order)
    VALUES ('Строительные материалы', NULL, 1)
    ON CONFLICT DO NOTHING
    RETURNING id
), root AS (
    SELECT id FROM ins_root
    UNION ALL
    SELECT id FROM t_p60494808_erp_system_creation.material_categories
    WHERE parent_id IS NULL AND lower(name) = lower('Строительные материалы') LIMIT 1
), ins_metal AS (
    INSERT INTO t_p60494808_erp_system_creation.material_categories (name, parent_id, sort_order)
    SELECT 'Металлопрокат', (SELECT id FROM root LIMIT 1), 1
    ON CONFLICT DO NOTHING
    RETURNING id
), metal AS (
    SELECT id FROM ins_metal
    UNION ALL
    SELECT mc.id FROM t_p60494808_erp_system_creation.material_categories mc
    WHERE mc.parent_id = (SELECT id FROM root LIMIT 1) AND lower(mc.name) = lower('Металлопрокат') LIMIT 1
)
INSERT INTO t_p60494808_erp_system_creation.material_categories (name, parent_id, sort_order)
SELECT 'Арматура рифленная', (SELECT id FROM metal LIMIT 1), 1
ON CONFLICT DO NOTHING;