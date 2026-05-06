ALTER TABLE t_p60494808_erp_system_creation.deals
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
