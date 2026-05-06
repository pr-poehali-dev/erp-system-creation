-- Добавляем поля для многошагового флоу КП → Планирование
ALTER TABLE t_p60494808_erp_system_creation.deals
  ADD COLUMN IF NOT EXISTS kp_slot_id integer REFERENCES t_p60494808_erp_system_creation.slots(id),
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed_at timestamp with time zone;
