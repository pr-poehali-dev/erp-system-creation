INSERT INTO t_p60494808_erp_system_creation.suppliers (id, name, category)
VALUES (0, '(не указан)', 'прочее')
ON CONFLICT (id) DO NOTHING;

INSERT INTO t_p60494808_erp_system_creation.materials (id, name, unit)
VALUES (0, '(не указан)', 'шт')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE t_p60494808_erp_system_creation.invoices
  ALTER COLUMN supplier_id SET DEFAULT 0,
  ALTER COLUMN material_id SET DEFAULT 0;
