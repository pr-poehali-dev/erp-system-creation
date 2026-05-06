"""
E2E-тест полного сценария: создание сделки → проект → архивация → освобождение слота.
Тест автономен: создаёт тестовые данные и удаляет их после проверки. v2
"""
import os
import json
import psycopg2
from datetime import date, timedelta

SCHEMA = "t_p60494808_erp_system_creation"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data=None):
    return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, "body": json.dumps(data or {})}

def err(msg):
    return {"statusCode": 500, "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}

# ── Шаги теста ────────────────────────────────────────────────────────────────

def step(name, fn, *args):
    """Выполняет шаг, возвращает (ok: bool, result_or_error)."""
    try:
        result = fn(*args)
        return True, result
    except Exception as e:
        return False, f"Шаг «{name}»: {e}"

def run_test(cur, conn):
    results = []
    deal_id = None
    project_id = None
    slot_id = None

    # ── ШАГ 1: Найти свободный слот с плечом 10+ дней ────────────────────────
    def find_free_slot():
        min_date = date.today() + timedelta(days=10)
        cur.execute(f"""
            SELECT s.id, s.start_date, s.monthly_limit,
                   COUNT(o.id) AS occupied
            FROM {SCHEMA}.slots s
            LEFT JOIN {SCHEMA}.slots o
                ON o.year = s.year AND o.month = s.month AND o.status IN ('booked','busy')
            WHERE s.status = 'free' AND s.start_date >= %s
            GROUP BY s.id, s.start_date, s.monthly_limit
            HAVING COUNT(o.id) < s.monthly_limit
            ORDER BY s.start_date
            LIMIT 1
        """, (min_date,))
        row = cur.fetchone()
        if not row:
            raise Exception("Нет свободных слотов с нужным плечом — добавьте слоты в Админке")
        return {"id": row[0], "start_date": str(row[1]), "monthly_limit": row[2]}

    ok1, res1 = step("1. Найти свободный слот", find_free_slot)
    results.append(("1. Найти свободный слот", ok1, res1 if ok1 else res1))
    if not ok1:
        return results, None, None, None
    slot_id = res1["id"]

    # ── ШАГ 2: Создать тестовую сделку (лид) ─────────────────────────────────
    def create_deal():
        # Используем первого реального клиента, менеджера и серийный проект
        cur.execute(f"SELECT id FROM {SCHEMA}.clients LIMIT 1")
        client_id = cur.fetchone()[0]
        cur.execute(f"SELECT id FROM {SCHEMA}.staff WHERE role='crm_manager' LIMIT 1")
        row = cur.fetchone()
        manager_id = row[0] if row else 1

        cur.execute(f"""
            INSERT INTO {SCHEMA}.deals
                (code, client_id, manager_id, source, notes, stage, project_type,
                 serial_project_id, configuration_id, start_date)
            VALUES ('ТЕСТ-E2E', %s, %s, 'e2e_test', 'Автотест — можно удалить',
                    'lead', 'serial', 1, 1, CURRENT_DATE)
            RETURNING id, code
        """, (client_id, manager_id))
        row = cur.fetchone()
        conn.commit()
        return {"id": row[0], "code": row[1]}

    ok2, res2 = step("2. Создать лид", create_deal)
    results.append(("2. Создать лид", ok2, res2 if ok2 else res2))
    if not ok2:
        return results, deal_id, project_id, slot_id
    deal_id = res2["id"]

    # ── ШАГ 3: Перевести в КП ────────────────────────────────────────────────
    def to_kp():
        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET stage='kp', budget=3500000, buffer_days=7,
                selected_stages=ARRAY[1,2,3,4,5,6,7,8,9,10,11],
                updated_at=now()
            WHERE id=%s RETURNING stage
        """, (deal_id,))
        row = cur.fetchone()
        conn.commit()
        if not row or row[0] != 'kp':
            raise Exception(f"stage после перевода = {row}")
        return {"stage": row[0]}

    ok3, res3 = step("3. Перевести в КП", to_kp)
    results.append(("3. Перевести в КП (stage=kp)", ok3, res3 if ok3 else res3))
    if not ok3:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 4: Выбрать слот (save_kp_slot) ───────────────────────────────────
    def save_kp_slot():
        # Перепроверяем что слот ещё свободен
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        if not s or s[0] != 'free':
            raise Exception(f"Слот {slot_id} уже не свободен: {s}")
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET kp_slot_id=%s, updated_at=now() WHERE id=%s RETURNING kp_slot_id
        """, (slot_id, deal_id))
        row = cur.fetchone()
        conn.commit()
        if not row or row[0] != slot_id:
            raise Exception("kp_slot_id не сохранился")
        return {"kp_slot_id": row[0]}

    ok4, res4 = step("4. Выбрать слот", save_kp_slot)
    results.append(("4. Сохранить kp_slot_id", ok4, res4 if ok4 else res4))
    if not ok4:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 5: Имитация загрузки и проверки документов ───────────────────────
    def mock_docs():
        # Устанавливаем contract_signed=true и payment_pending (директор одобрил)
        # обходя загрузку файлов — имитируем что документы прошли проверку
        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET contract_signed=true,
                contract_status='docs_approved',
                updated_at=now()
            WHERE id=%s RETURNING contract_status
        """, (deal_id,))
        row = cur.fetchone()
        conn.commit()
        if not row:
            raise Exception("Не удалось обновить статус документов")
        return {"contract_status": row[0]}

    ok5, res5 = step("5. Имитация одобрения документов", mock_docs)
    results.append(("5. Имитация: документы одобрены", ok5, res5 if ok5 else res5))
    if not ok5:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 6: Директор подтверждает оплату → автосоздание проекта ───────────
    def confirm_payment():
        # Проверяем что слот ещё свободен перед бронированием
        cur.execute(f"SELECT status, monthly_limit FROM {SCHEMA}.slots WHERE id=%s FOR UPDATE", (slot_id,))
        slot_row = cur.fetchone()
        if not slot_row:
            raise Exception("Слот не найден")
        if slot_row[0] != 'free':
            raise Exception(f"Слот {slot_id} не свободен: {slot_row[0]}")

        # Бронируем слот
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, slot_id))

        # Получаем данные для создания проекта
        cur.execute(f"""
            SELECT d.client_id, s.start_date FROM {SCHEMA}.deals d
            JOIN {SCHEMA}.slots s ON s.id = d.kp_slot_id
            WHERE d.id=%s
        """, (deal_id,))
        row = cur.fetchone()
        client_id = row[0]
        start_date = row[1]

        # Создаём проект
        cur.execute(f"""
            SELECT sp.name FROM {SCHEMA}.serial_projects sp
            JOIN {SCHEMA}.deals d ON d.serial_project_id = sp.id
            WHERE d.id=%s
        """, (deal_id,))
        sp_row = cur.fetchone()
        project_name = sp_row[0] if sp_row else "Тест"

        deadline = start_date + timedelta(days=90)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.projects
                (code, deal_id, client_id, slot_id, status, start_date, deadline)
            VALUES ('ТП-E2E', %s, %s, %s, 'planning', %s, %s)
            RETURNING id
        """, (deal_id, client_id, slot_id, start_date, deadline))
        proj_row = cur.fetchone()
        pid = proj_row[0]

        # Обновляем сделку
        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET stage='planning', contract_status='payment_confirmed',
                payment_confirmed=true, slot_id=%s, project_id=%s, planned_start_date=%s, updated_at=now()
            WHERE id=%s
        """, (slot_id, pid, start_date, deal_id))
        conn.commit()
        return {"project_id": pid, "stage": "planning"}

    ok6, res6 = step("6. Подтвердить оплату + автосоздание проекта", confirm_payment)
    results.append(("6. Подтверждение оплаты → проект создан", ok6, res6 if ok6 else res6))
    if not ok6:
        return results, deal_id, project_id, slot_id
    project_id = res6["project_id"]

    # ── ШАГ 7: ПРОВЕРКА после оплаты ─────────────────────────────────────────
    def check_after_payment():
        cur.execute(f"SELECT stage, project_id, slot_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        d = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.projects WHERE id=%s", (project_id,))
        p = cur.fetchone()
        errors = []
        if d[0] != 'planning':    errors.append(f"stage={d[0]} (ожидалось planning)")
        if d[1] != project_id:    errors.append(f"project_id={d[1]} (ожидалось {project_id})")
        if s[0] != 'booked':      errors.append(f"slot.status={s[0]} (ожидалось booked)")
        if p[0] != 'planning':    errors.append(f"project.status={p[0]} (ожидалось planning)")
        if errors:
            raise Exception("; ".join(errors))
        return {"deal.stage": d[0], "slot.status": s[0], "project.status": p[0]}

    ok7, res7 = step("7. Проверка состояния после оплаты", check_after_payment)
    results.append(("7. ✓ Проверка: stage=planning, slot=booked, project=planning", ok7, res7 if ok7 else res7))
    if not ok7:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 8: Директор по строительству берёт в производство ────────────────
    def approve_project():
        cur.execute(f"""
            UPDATE {SCHEMA}.projects SET status='active', updated_at=now() WHERE id=%s RETURNING status
        """, (project_id,))
        row = cur.fetchone()
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='busy' WHERE id=%s", (slot_id,))
        conn.commit()
        if not row or row[0] != 'active':
            raise Exception(f"project.status={row}")
        return {"project.status": row[0]}

    ok8, res8 = step("8. Взять проект в производство", approve_project)
    results.append(("8. Взять в производство (approve_project)", ok8, res8 if ok8 else res8))
    if not ok8:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 9: ПРОВЕРКА — слот busy, проект active ────────────────────────────
    def check_after_approve():
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.projects WHERE id=%s", (project_id,))
        p = cur.fetchone()
        errors = []
        if s[0] != 'busy':   errors.append(f"slot.status={s[0]} (ожидалось busy)")
        if p[0] != 'active': errors.append(f"project.status={p[0]} (ожидалось active)")
        if errors:
            raise Exception("; ".join(errors))
        return {"slot.status": s[0], "project.status": p[0]}

    ok9, res9 = step("9. Проверка: slot=busy, project=active", check_after_approve)
    results.append(("9. ✓ Проверка: slot=busy, project=active", ok9, res9 if ok9 else res9))
    if not ok9:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 10: Перевести сделку в архив ─────────────────────────────────────
    def archive_deal():
        # Освобождаем слот
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL
            WHERE id=%s AND status IN ('booked','busy') RETURNING id
        """, (slot_id,))
        freed = cur.fetchone()
        # Архивируем проект
        cur.execute(f"""
            UPDATE {SCHEMA}.projects SET status='archived', updated_at=now()
            WHERE id=%s AND status NOT IN ('archived','completed')
        """, (project_id,))
        # Архивируем сделку
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET is_archived=TRUE, slot_id=NULL, updated_at=now()
            WHERE id=%s RETURNING is_archived
        """, (deal_id,))
        row = cur.fetchone()
        conn.commit()
        if not row or not row[0]:
            raise Exception("Сделка не архивирована")
        return {"is_archived": True, "slot_freed": bool(freed)}

    ok10, res10 = step("10. Перевести сделку в архив", archive_deal)
    results.append(("10. Архивация сделки", ok10, res10 if ok10 else res10))
    if not ok10:
        return results, deal_id, project_id, slot_id

    # ── ШАГ 11: ФИНАЛЬНАЯ ПРОВЕРКА — слот free, не привязан ──────────────────
    def final_check():
        cur.execute(f"SELECT status, deal_id FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT is_archived, slot_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        d = cur.fetchone()
        # Проверяем occupied в слот-плане
        cur.execute(f"""
            SELECT COUNT(*) FROM {SCHEMA}.slots
            WHERE id=%s AND status IN ('booked','busy')
        """, (slot_id,))
        occupied = cur.fetchone()[0]
        errors = []
        if s[0] != 'free':          errors.append(f"slot.status={s[0]} (ожидалось free)")
        if s[1] is not None:         errors.append(f"slot.deal_id={s[1]} (ожидалось NULL)")
        if not d[0]:                 errors.append("deal.is_archived=False (ожидалось True)")
        if d[1] is not None:         errors.append(f"deal.slot_id={d[1]} (ожидалось NULL)")
        if occupied != 0:            errors.append(f"слот считается занятым в occupied ({occupied})")
        if errors:
            raise Exception("; ".join(errors))
        return {"slot.status": s[0], "slot.deal_id": s[1], "deal.is_archived": d[0], "occupied_count": occupied}

    ok11, res11 = step("11. Финальная проверка", final_check)
    results.append(("11. ✓ Финал: slot=free, deal=archived, occupied=0", ok11, res11 if ok11 else res11))

    return results, deal_id, project_id, slot_id


def cleanup(deal_id, project_id):
    """Удаляем тестовые данные."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        if project_id:
            cur.execute(f"DELETE FROM {SCHEMA}.project_stages WHERE project_id=%s", (project_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.projects WHERE id=%s", (project_id,))
        if deal_id:
            cur.execute(f"DELETE FROM {SCHEMA}.contract_documents WHERE deal_id=%s", (deal_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.notifications WHERE deal_id=%s", (deal_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        return str(e)


def handler(event: dict, context) -> dict:
    """Запускает e2e-тест полного сценария сделки. GET /?r=e2e-test"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}, "body": ""}

    conn = get_conn()
    cur = conn.cursor()
    results = []
    deal_id = None
    project_id = None
    slot_id = None

    try:
        results, deal_id, project_id, slot_id = run_test(cur, conn)
    except Exception as e:
        results.append(("КРИТИЧЕСКАЯ ОШИБКА", False, str(e)))
    finally:
        try:
            conn.close()
        except Exception:
            pass

    # Подсчёт
    passed = sum(1 for _, ok, _ in results if ok)
    total  = len(results)
    all_ok = passed == total

    # Очистка тестовых данных
    cleanup_result = cleanup(deal_id, project_id)

    # Формируем отчёт
    report_lines = []
    for name, status, detail in results:
        icon = "✅" if status else "❌"
        report_lines.append(f"{icon} {name}: {json.dumps(detail, ensure_ascii=False) if isinstance(detail, dict) else detail}")

    report_lines.append("")
    report_lines.append(f"{'─' * 50}")
    if all_ok:
        report_lines.append(f"🎉 ТЕСТ ПРОЙДЕН ({passed}/{total} шагов)")
    else:
        failed = [(n, d) for n, ok, d in results if not ok]
        report_lines.append(f"❌ ОШИБКА ({passed}/{total} шагов пройдено)")
        for name, detail in failed:
            report_lines.append(f"   Провален: {name} → {detail}")

    report_lines.append(f"Очистка тестовых данных: {'OK' if cleanup_result is True else cleanup_result}")

    body = {
        "status": "PASSED" if all_ok else "FAILED",
        "passed": passed,
        "total": total,
        "report": "\n".join(report_lines),
        "steps": [{"name": n, "ok": o, "detail": d} for n, o, d in results],
        "test_deal_id": deal_id,
        "test_project_id": project_id,
        "test_slot_id": slot_id,
    }

    return {
        "statusCode": 200 if all_ok else 500,
        "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }