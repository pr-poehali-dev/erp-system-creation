-- Поля для шкалы комиссии риэлторов
-- Фиксируется в момент закрытия сделки (stage='closed')

-- 1. Поле для зафиксированной комиссии в карточке сделки
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(14,2) NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN deals.commission_rate IS 'Процент комиссии риэлтора, зафиксированный в момент закрытия (3/4.5/5.5)';
COMMENT ON COLUMN deals.commission_amount IS 'Сумма комиссии в рублях = budget * commission_rate / 100';
COMMENT ON COLUMN deals.closed_at IS 'Дата/время перехода сделки в статус closed';

-- 2. Денормализованные поля квалификации для staff (риэлторы)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS closed_deals_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualification VARCHAR(20) NOT NULL DEFAULT 'novice';

COMMENT ON COLUMN staff.closed_deals_count IS 'Количество закрытых сделок риэлтора (только для role=realtor)';
COMMENT ON COLUMN staff.qualification IS 'novice (0-4) | inTopic (5-8) | pro (9+)';

-- 3. Бэкфил по существующим закрытым сделкам
UPDATE staff s
SET closed_deals_count = sub.cnt
FROM (
  SELECT realtor_id, COUNT(*) AS cnt
  FROM deals
  WHERE stage = 'closed' AND realtor_id IS NOT NULL
  GROUP BY realtor_id
) sub
WHERE s.id = sub.realtor_id;

UPDATE staff
SET qualification = CASE
  WHEN closed_deals_count >= 9 THEN 'pro'
  WHEN closed_deals_count >= 5 THEN 'inTopic'
  ELSE 'novice'
END
WHERE role = 'realtor';
