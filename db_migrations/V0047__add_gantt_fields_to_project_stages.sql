ALTER TABLE t_p60494808_erp_system_creation.project_stages
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES t_p60494808_erp_system_creation.project_stages(id),
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NULL;

ALTER TABLE t_p60494808_erp_system_creation.project_stages
  ADD CONSTRAINT progress_percent_range CHECK (progress_percent >= 0 AND progress_percent <= 100);
