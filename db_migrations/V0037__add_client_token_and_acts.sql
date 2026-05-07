-- Добавляем client_token в deals
ALTER TABLE t_p60494808_erp_system_creation.deals
  ADD COLUMN IF NOT EXISTS client_token VARCHAR(30) UNIQUE;

-- Таблица актов для клиентского ЛК
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.client_acts (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,
  deal_id      INTEGER REFERENCES t_p60494808_erp_system_creation.deals(id),
  project_id   INTEGER REFERENCES t_p60494808_erp_system_creation.projects(id),
  stage_id     INTEGER REFERENCES t_p60494808_erp_system_creation.project_stages(id),
  title        VARCHAR(200) NOT NULL,
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  status       VARCHAR(30) NOT NULL DEFAULT 'pending_signature',
  signed_at    TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Индекс для быстрого поиска по сделке
CREATE INDEX IF NOT EXISTS idx_client_acts_deal_id ON t_p60494808_erp_system_creation.client_acts(deal_id);
