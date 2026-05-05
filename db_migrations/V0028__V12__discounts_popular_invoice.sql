-- V12: скидки в комплектациях, популярная комплектация, файл счёта в заявках на выплату

-- 1. Скидки и пометка "популярная" в комплектациях
ALTER TABLE t_p60494808_erp_system_creation.configurations
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_until date,
  ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;

-- Установим Предчистовую как популярную по умолчанию
UPDATE t_p60494808_erp_system_creation.configurations
SET is_popular = true
WHERE name ILIKE '%предчист%';

-- 2. Файл счёта на оплату в заявках на выплату + комментарий отклонения
ALTER TABLE t_p60494808_erp_system_creation.payout_requests
  ADD COLUMN IF NOT EXISTS invoice_file_url varchar(1000),
  ADD COLUMN IF NOT EXISTS invoice_file_name varchar(500),
  ADD COLUMN IF NOT EXISTS reject_comment text;