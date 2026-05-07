CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.payment_schedule (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES t_p60494808_erp_system_creation.deals(id),
  order_index INTEGER NOT NULL DEFAULT 1,
  stage_name  VARCHAR(200) NOT NULL DEFAULT '',
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  stage_id    INTEGER REFERENCES t_p60494808_erp_system_creation.project_stages(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_deal_id ON t_p60494808_erp_system_creation.payment_schedule(deal_id);
