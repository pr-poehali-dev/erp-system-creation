-- Тестовый счёт с материалом "Арматура А500С d10" (id=27, категория "Арматура рифленная")
INSERT INTO t_p60494808_erp_system_creation.invoices
    (supplier_id, material_id, material_name_raw, invoice_date, invoice_number,
     unit_price, quantity, recognition_status)
VALUES
    (0, 27, 'Арматура А500С d10 (ГОСТ 34028)', CURRENT_DATE, 'ТЕСТ-КАТ-001',
     58000, 2.5, 'обработан');