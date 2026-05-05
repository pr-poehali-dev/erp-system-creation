ALTER TABLE t_p60494808_erp_system_creation.project_stages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();