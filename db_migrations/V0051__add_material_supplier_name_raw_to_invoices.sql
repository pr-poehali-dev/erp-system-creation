ALTER TABLE t_p60494808_erp_system_creation.invoices
  ADD COLUMN IF NOT EXISTS material_name_raw VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS supplier_name_raw VARCHAR(300) NULL;