-- ============================================================
-- Статусы contract_documents расширяем:
-- pending → uploaded → review (отправлено директору) → approved / rejected → payment_pending → payment_confirmed
-- ============================================================
ALTER TABLE t_p60494808_erp_system_creation.contract_documents
    ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by   INTEGER REFERENCES t_p60494808_erp_system_creation.staff(id),
    ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- Статус всего пакета по сделке храним отдельным полем в deals
ALTER TABLE t_p60494808_erp_system_creation.deals
    ADD COLUMN IF NOT EXISTS contract_status VARCHAR(40) DEFAULT 'none';
-- none → docs_uploaded → docs_review → docs_approved → payment_pending → payment_confirmed

-- ============================================================
-- Таблица уведомлений
-- ============================================================
CREATE TABLE IF NOT EXISTS t_p60494808_erp_system_creation.notifications (
    id          SERIAL PRIMARY KEY,
    -- Кому: role или конкретный staff_id
    role        VARCHAR(30),           -- 'director', 'crm_manager', etc.
    staff_id    INTEGER REFERENCES t_p60494808_erp_system_creation.staff(id),
    -- Тип и содержание
    type        VARCHAR(50) NOT NULL,  -- 'docs_for_review', 'docs_approved', 'docs_rejected', 'payment_pending', 'payment_confirmed'
    title       VARCHAR(300) NOT NULL,
    body        TEXT,
    -- Ссылка на объект
    deal_id     INTEGER REFERENCES t_p60494808_erp_system_creation.deals(id),
    -- Статус
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_role     ON t_p60494808_erp_system_creation.notifications(role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_staff    ON t_p60494808_erp_system_creation.notifications(staff_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_deal     ON t_p60494808_erp_system_creation.notifications(deal_id);