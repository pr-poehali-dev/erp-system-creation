-- Иерархический справочник категорий материалов (неограниченная вложенность)
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.material_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(300) NOT NULL,
    parent_id   INTEGER NULL REFERENCES t_p60494808_erp_system_creation.material_categories(id),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Уникальность имени в пределах одного родителя.
CREATE UNIQUE INDEX IF NOT EXISTS uq_matcat_name_parent
    ON t_p60494808_erp_system_creation.material_categories (parent_id, lower(name))
    WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_matcat_name_root
    ON t_p60494808_erp_system_creation.material_categories (lower(name))
    WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_matcat_parent
    ON t_p60494808_erp_system_creation.material_categories (parent_id);

-- Связь материалов с категорией
ALTER TABLE t_p60494808_erp_system_creation.materials
    ADD COLUMN IF NOT EXISTS category_id INTEGER NULL
    REFERENCES t_p60494808_erp_system_creation.material_categories(id);

CREATE INDEX IF NOT EXISTS idx_materials_category_id
    ON t_p60494808_erp_system_creation.materials (category_id);