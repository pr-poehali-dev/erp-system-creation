-- V11: версионирование шаблонов, подписанные директором документы, заявки на выплату

-- 1. Версия шаблона документа (для подсветки "новый")
ALTER TABLE t_p60494808_erp_system_creation.doc_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prev_file_url varchar(1000),
  ADD COLUMN IF NOT EXISTS prev_file_name varchar(500);

-- 2. Подписанный директором вариант документа (для каждой сделки)
ALTER TABLE t_p60494808_erp_system_creation.contract_documents
  ADD COLUMN IF NOT EXISTS signed_file_url varchar(1000),
  ADD COLUMN IF NOT EXISTS signed_file_name varchar(500),
  ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_seen_signed boolean DEFAULT false;

-- 3. Таблица заявок на выплату вознаграждения
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.payout_requests (
  id            serial PRIMARY KEY,
  deal_id       integer NOT NULL REFERENCES t_p60494808_erp_system_creation.deals(id),
  manager_id    integer NOT NULL REFERENCES t_p60494808_erp_system_creation.staff(id),
  amount        numeric(14,2),
  status        varchar(30) NOT NULL DEFAULT 'pending',
  notes         text,
  requested_at  timestamp with time zone DEFAULT now(),
  reviewed_at   timestamp with time zone,
  reviewed_by   integer REFERENCES t_p60494808_erp_system_creation.staff(id),
  created_at    timestamp with time zone DEFAULT now()
);