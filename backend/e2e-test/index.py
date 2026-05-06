"""
E2E-тест полного сценария: создание сделки → проект → производство → архивация → освобождение слота.
Проверяет роли: crm_manager (менеджер продаж), director (гендиректор), construction_director.
Тест автономен: создаёт тестовые данные и ВСЕГДА удаляет их в finally, даже при ошибке.
v3
"""
import os
import json
import psycopg2
from datetime import date, timedelta

SCHEMA = "t_p60494808_erp_system_creation"
TEST_CODE_DEAL    = "ТЕСТ-E2E"
TEST_CODE_PROJECT = "ТП-E2E"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cleanup(deal_id, project_id, slot_id):
    """Освобождаем тестовые данные — вызывается ВСЕГДА в finally."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        # Освобождаем слот если он был занят тестом
        if slot_id:
            cur.execute(f"""
                UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL
                WHERE id=%s AND deal_id=%s
            """, (slot_id, deal_id))
        if project_id:
            cur.execute(f"DELETE FROM {SCHEMA}.project_stages WHERE project_id=%s", (project_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.projects WHERE id=%s AND code=%s", (project_id, TEST_CODE_PROJECT))
        if deal_id:
            cur.execute(f"DELETE FROM {SCHEMA}.contract_documents WHERE deal_id=%s", (deal_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.notifications WHERE deal_id=%s", (deal_id,))
            cur.execute(f"DELETE FROM {SCHEMA}.deals WHERE id=%s AND code=%s", (deal_id, TEST_CODE_DEAL))
        conn.commit()
        conn.close()
        return "OK"
    except Exception as e:
        return f"cleanup error: {e}"


def run_test(cur, conn):
    """
    Полный сценарий:
    1.  Найти свободный слот (с лимитом и плечом)
    2.  Создать лид                     [роль: crm_manager]
    3.  Перевести в КП                  [роль: crm_manager]
    4.  Выбрать производственный слот   [роль: crm_manager]
    5.  Имитация: документы загружены и одобрены [роль: director]
    6.  Директор подтверждает оплату → слот booked + проект создан [роль: director]
    ПРОВЕРКА: stage=planning, slot=booked, project=planning
    7.  Директор по строительству берёт в производство [роль: construction_director]
    ПРОВЕРКА: slot=busy, project=active
    8.  Директор архивирует сделку → слот free [роль: director]
    ПРОВЕРКА: slot=free, slot.deal_id=NULL, occupied=0
    """
    results   = []
    deal_id   = None
    project_id = None
    slot_id   = None

    def chk(name, fn):
        ok_, res_ = True, None
        try:
            res_ = fn()
        except Exception as e:
            ok_, res_ = False, str(e)
        results.append({"name": name, "ok": ok_, "detail": res_})
        return ok_, res_

    # ── 1. Найти свободный слот ─────────────────────────────────────────────
    def find_slot():
        min_date = date.today() + timedelta(days=10)
        cur.execute(f"""
            SELECT s.id, s.start_date, s.monthly_limit,
                   COALESCE((
                       SELECT COUNT(*) FROM {SCHEMA}.slots o
                       WHERE o.year=s.year AND o.month=s.month AND o.status IN ('booked','busy')
                   ), 0) AS occupied
            FROM {SCHEMA}.slots s
            WHERE s.status='free' AND s.start_date >= %s
            ORDER BY s.start_date
        """, (min_date,))
        for row in cur.fetchall():
            if row[3] < row[2]:
                return {"slot_id": row[0], "start_date": str(row[1]), "limit": row[2], "occupied": int(row[3])}
        raise Exception("Нет свободных слотов с нужным плечом — добавьте слоты в Админке")

    ok, res = chk("1. [crm_manager] Найти свободный слот (плечо 10+ дн.)", find_slot)
    if not ok: return results, deal_id, project_id, slot_id
    slot_id = res["slot_id"]

    # ── 2. Создать лид ──────────────────────────────────────────────────────
    def create_lead():
        cur.execute(f"SELECT id FROM {SCHEMA}.clients LIMIT 1")
        client_id = cur.fetchone()[0]
        cur.execute(f"SELECT id FROM {SCHEMA}.staff WHERE role='crm_manager' LIMIT 1")
        r = cur.fetchone()
        mgr_id = r[0] if r else 1
        cur.execute(f"""
            INSERT INTO {SCHEMA}.deals
                (code, client_id, manager_id, source, notes, stage, project_type,
                 serial_project_id, configuration_id, start_date)
            VALUES (%s, %s, %s, 'e2e_test', 'Автотест — удалится автоматически',
                    'lead', 'serial', 1, 1, CURRENT_DATE)
            RETURNING id, code
        """, (TEST_CODE_DEAL, client_id, mgr_id))
        row = cur.fetchone()
        conn.commit()
        return {"deal_id": row[0], "code": row[1]}

    ok, res = chk("2. [crm_manager] Создать лид", create_lead)
    if not ok: return results, deal_id, project_id, slot_id
    deal_id = res["deal_id"]

    # ── 3. Перевести в КП ───────────────────────────────────────────────────
    def to_kp():
        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET stage='kp', budget=3500000, buffer_days=7,
                selected_stages=ARRAY[1,2,3,4,5,6,7,8,9,10,11],
                updated_at=now()
            WHERE id=%s RETURNING stage
        """, (deal_id,))
        row = cur.fetchone(); conn.commit()
        if not row or row[0] != 'kp': raise Exception(f"stage={row}")
        return {"stage": row[0]}

    ok, res = chk("3. [crm_manager] Перевести в КП (stage=kp)", to_kp)
    if not ok: return results, deal_id, project_id, slot_id

    # ── 4. Выбрать производственный слот ────────────────────────────────────
    def save_kp_slot():
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        if not s or s[0] != 'free': raise Exception(f"Слот {slot_id} уже не свободен: {s}")
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET kp_slot_id=%s, updated_at=now()
            WHERE id=%s RETURNING kp_slot_id
        """, (slot_id, deal_id))
        row = cur.fetchone(); conn.commit()
        if not row or row[0] != slot_id: raise Exception("kp_slot_id не сохранился")
        return {"kp_slot_id": row[0]}

    ok, res = chk("4. [crm_manager] Выбрать производственный слот", save_kp_slot)
    if not ok: return results, deal_id, project_id, slot_id

    # ── 5. [director] Имитация: документы одобрены ──────────────────────────
    def mock_docs():
        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET contract_signed=true, contract_status='docs_approved', updated_at=now()
            WHERE id=%s RETURNING contract_status
        """, (deal_id,))
        row = cur.fetchone(); conn.commit()
        if not row: raise Exception("Не удалось обновить статус документов")
        return {"contract_status": row[0]}

    ok, res = chk("5. [director] Документы загружены и одобрены (имитация)", mock_docs)
    if not ok: return results, deal_id, project_id, slot_id

    # ── 6. [director] Подтвердить оплату → booked + проект ──────────────────
    def confirm_payment():
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s FOR UPDATE", (slot_id,))
        s = cur.fetchone()
        if not s or s[0] != 'free': raise Exception(f"Слот не свободен: {s}")

        cur.execute(f"SELECT start_date FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        start_date = cur.fetchone()[0]
        cur.execute(f"SELECT client_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        client_id = cur.fetchone()[0]

        cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, slot_id))

        deadline = start_date + timedelta(days=90)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.projects (code, deal_id, client_id, slot_id, status, start_date, deadline)
            VALUES (%s, %s, %s, %s, 'planning', %s, %s) RETURNING id
        """, (TEST_CODE_PROJECT, deal_id, client_id, slot_id, start_date, deadline))
        pid = cur.fetchone()[0]

        cur.execute(f"""
            UPDATE {SCHEMA}.deals
            SET stage='planning', contract_status='payment_confirmed', payment_confirmed=true,
                slot_id=%s, project_id=%s, planned_start_date=%s, updated_at=now()
            WHERE id=%s
        """, (slot_id, pid, start_date, deal_id))
        conn.commit()
        return {"project_id": pid}

    ok, res = chk("6. [director] Подтвердить оплату → слот booked + проект создан", confirm_payment)
    if not ok: return results, deal_id, project_id, slot_id
    project_id = res["project_id"]

    # ── ПРОВЕРКА после оплаты ───────────────────────────────────────────────
    def check_after_payment():
        cur.execute(f"SELECT stage, project_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        d = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.projects WHERE id=%s", (project_id,))
        p = cur.fetchone()
        errs = []
        if d[0] != 'planning':   errs.append(f"deal.stage={d[0]}")
        if d[1] != project_id:   errs.append(f"deal.project_id={d[1]}")
        if s[0] != 'booked':     errs.append(f"slot.status={s[0]}")
        if p[0] != 'planning':   errs.append(f"project.status={p[0]}")
        if errs: raise Exception("; ".join(errs))
        return {"deal.stage": d[0], "slot.status": s[0], "project.status": p[0]}

    chk("   ✓ Проверка: stage=planning, slot=booked, project=planning", check_after_payment)

    # ── 7. [construction_director] Взять в производство ─────────────────────
    def approve_project():
        cur.execute(f"""
            UPDATE {SCHEMA}.projects SET status='active', updated_at=now()
            WHERE id=%s RETURNING status
        """, (project_id,))
        row = cur.fetchone()
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='busy' WHERE id=%s", (slot_id,))
        conn.commit()
        if not row or row[0] != 'active': raise Exception(f"project.status={row}")
        return {"project.status": row[0]}

    ok, _ = chk("7. [construction_director] Взять проект в производство", approve_project)
    if not ok: return results, deal_id, project_id, slot_id

    # ── ПРОВЕРКА после approve ──────────────────────────────────────────────
    def check_after_approve():
        cur.execute(f"SELECT status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT status FROM {SCHEMA}.projects WHERE id=%s", (project_id,))
        p = cur.fetchone()
        errs = []
        if s[0] != 'busy':   errs.append(f"slot.status={s[0]}")
        if p[0] != 'active': errs.append(f"project.status={p[0]}")
        if errs: raise Exception("; ".join(errs))
        return {"slot.status": s[0], "project.status": p[0]}

    chk("   ✓ Проверка: slot=busy, project=active", check_after_approve)

    # ── 8. [director] Архивировать сделку → слот free ───────────────────────
    def archive_deal():
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL
            WHERE id=%s AND status IN ('booked','busy') RETURNING id
        """, (slot_id,))
        freed = cur.fetchone()
        cur.execute(f"""
            UPDATE {SCHEMA}.projects SET status='archived', updated_at=now()
            WHERE id=%s
        """, (project_id,))
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET is_archived=TRUE, slot_id=NULL, updated_at=now()
            WHERE id=%s RETURNING is_archived
        """, (deal_id,))
        row = cur.fetchone(); conn.commit()
        if not row or not row[0]: raise Exception("Сделка не архивирована")
        return {"is_archived": True, "slot_freed": bool(freed)}

    ok, _ = chk("8. [director] Архивировать сделку → слот освобождён", archive_deal)
    if not ok: return results, deal_id, project_id, slot_id

    # ── ФИНАЛЬНАЯ ПРОВЕРКА ──────────────────────────────────────────────────
    def final_check():
        cur.execute(f"SELECT status, deal_id FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        s = cur.fetchone()
        cur.execute(f"SELECT is_archived, slot_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
        d = cur.fetchone()
        cur.execute(f"""
            SELECT COUNT(*) FROM {SCHEMA}.slots
            WHERE id=%s AND status IN ('booked','busy')
        """, (slot_id,))
        occupied = cur.fetchone()[0]
        errs = []
        if s[0] != 'free':       errs.append(f"slot.status={s[0]} (ожидалось free)")
        if s[1] is not None:     errs.append(f"slot.deal_id={s[1]} (ожидалось NULL)")
        if not d[0]:             errs.append("deal.is_archived=False")
        if d[1] is not None:     errs.append(f"deal.slot_id={d[1]} (ожидалось NULL)")
        if occupied != 0:        errs.append(f"слот считается занятым (occupied={occupied})")
        if errs: raise Exception("; ".join(errs))
        return {"slot.status": s[0], "slot.deal_id": s[1], "occupied_in_plan": occupied}

    chk("   ✓ Финал: slot=free, deal=archived, occupied=0 в админке", final_check)

    return results, deal_id, project_id, slot_id


def handler(event: dict, context) -> dict:
    """E2E-тест полного сценария сделки по ролям. GET /?r=e2e-test"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"}, "body": ""}

    conn = get_conn()
    cur  = conn.cursor()
    results   = []
    deal_id   = None
    project_id = None
    slot_id   = None

    try:
        results, deal_id, project_id, slot_id = run_test(cur, conn)
    except Exception as e:
        results.append({"name": "КРИТИЧЕСКАЯ ОШИБКА", "ok": False, "detail": str(e)})
    finally:
        try: conn.close()
        except: pass
        # Атомарный cleanup ВСЕГДА — даже если тест упал на любом шаге
        cleanup_result = cleanup(deal_id, project_id, slot_id)

    passed   = sum(1 for r in results if r["ok"])
    total    = len(results)
    all_ok   = passed == total and total > 0

    lines = []
    for r in results:
        icon = "✅" if r["ok"] else "❌"
        detail = json.dumps(r["detail"], ensure_ascii=False) if isinstance(r["detail"], dict) else str(r["detail"])
        lines.append(f"{icon} {r['name']}: {detail}")
    lines += ["", "─" * 52]
    if all_ok:
        lines.append(f"🎉 ТЕСТ ПРОЙДЕН — {passed}/{total} шагов")
    else:
        lines.append(f"❌ ОШИБКА — {passed}/{total} шагов пройдено")
        for r in results:
            if not r["ok"]:
                lines.append(f"   ✗ {r['name']}: {r['detail']}")
    lines.append(f"Очистка тестовых данных: {cleanup_result}")

    body = {
        "status":     "PASSED" if all_ok else "FAILED",
        "passed":     passed,
        "total":      total,
        "report":     "\n".join(lines),
        "steps":      results,
        "cleanup":    cleanup_result,
    }
    return {
        "statusCode": 200 if all_ok else 500,
        "headers":    {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body":       json.dumps(body, ensure_ascii=False, default=str),
    }
