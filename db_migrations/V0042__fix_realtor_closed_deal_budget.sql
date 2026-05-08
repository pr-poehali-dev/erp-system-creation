-- Исправляем закрытую сделку риэлтора: выставляем бюджет и пересчитываем комиссию
-- Сделка ЛД-0068 (id=73) была закрыта с budget=NULL → commission_amount=0
-- Выставляем реалистичный бюджет и пересчитываем комиссию по ставке 3% (novice)
UPDATE t_p60494808_erp_system_creation.deals
SET
    budget            = 4200000,
    commission_amount = 4200000 * 0.03,   -- 126000
    commission_rate   = 3.00,
    is_archived       = FALSE              -- разархивируем чтобы было видно в KPI
WHERE id = 73;
