"""
ERP API — универсальный endpoint для всех операций системы.
Роуты: /deals, /projects, /procurement, /payments, /kcompany, /dashboard, /clients, /staff, /employees, /reports
"""
import json
import os
import base64
import random
import string
import psycopg2
import boto3
from datetime import date, datetime, timedelta
from decimal import Decimal

SCHEMA = "t_p60494808_erp_system_creation"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
    "Content-Type": "application/json",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def json_serial(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def ok(data, status=200):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(data, default=json_serial, ensure_ascii=False),
    }

def err(msg, status=400):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": msg}, ensure_ascii=False),
    }

def next_code(cur, table, prefix, col="code"):
    # Используем MAX по числовому суффиксу + FOR UPDATE чтобы избежать race condition
    cur.execute(f"""
        SELECT COALESCE(MAX(CAST(SPLIT_PART({col}, '-', 2) AS INTEGER)), 0) + 1
        FROM {SCHEMA}.{table}
        WHERE {col} LIKE %s
    """, (f"{prefix}-%",))
    n = cur.fetchone()[0]
    return f"{prefix}-{n:04d}"

# ─── DEALS ───────────────────────────────────────────────────────────────────

MIN_SLOT_LAG_DAYS = 10  # Минимальное плечо: слот не раньше чем через 10 дней от сегодня

def get_free_slots(cur, signed_date_str: str = None):
    """
    Возвращает свободные слоты.
    Минимальное плечо — 10 дней от сегодня.
    signed_date_str: если передана дата подписания — дополнительно фильтрует
    по signed_date + 15 дней.
    Архивные слоты не попадают в список и не влияют на загрузку.
    """
    min_start = date.today() + timedelta(days=MIN_SLOT_LAG_DAYS)
    if signed_date_str:
        try:
            signed = date.fromisoformat(signed_date_str)
            candidate = signed + timedelta(days=15)
            if candidate > min_start:
                min_start = candidate
        except Exception:
            pass

    cur.execute(f"""
        SELECT
            s.id, s.year, s.month, s.start_date, s.status, s.monthly_limit,
            COUNT(occupied.id) AS occupied_count
        FROM {SCHEMA}.slots s
        LEFT JOIN {SCHEMA}.slots occupied
            ON occupied.year = s.year
            AND occupied.month = s.month
            AND occupied.status IN ('booked', 'busy')
        WHERE s.status = 'free'
          AND s.start_date >= %s
        GROUP BY s.id, s.year, s.month, s.start_date, s.status, s.monthly_limit
        ORDER BY s.start_date
    """, (min_start,))
    cols = [desc[0] for desc in cur.description]
    slots = []
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        d["available"] = int(d["monthly_limit"]) - int(d["occupied_count"]) > 0
        d["occupied_count"] = int(d["occupied_count"])
        slots.append(d)
    return slots

def get_slot_plan(cur, show_archived: bool = False):
    """Полная картина слот-плана по месяцам + детальные слоты.
    Архивные слоты не учитываются в загрузке (прогресс-бар).
    """
    # Месяцы — только не-архивные слоты для расчёта загрузки
    cur.execute(f"""
        SELECT
            s.year, s.month, s.monthly_limit,
            COUNT(*) FILTER (WHERE s.status = 'free')     AS free_count,
            COUNT(*) FILTER (WHERE s.status = 'booked')   AS booked_count,
            COUNT(*) FILTER (WHERE s.status = 'busy')     AS busy_count,
            COUNT(*) FILTER (WHERE s.status = 'archived') AS archived_count
        FROM {SCHEMA}.slots s
        WHERE s.status != 'archived'
        GROUP BY s.year, s.month, s.monthly_limit
        ORDER BY s.year, s.month
    """)
    cols = [desc[0] for desc in cur.description]
    months = []
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        total_occupied = int(d["booked_count"]) + int(d["busy_count"])
        d["total_occupied"] = total_occupied
        d["load_pct"] = round(total_occupied / int(d["monthly_limit"]) * 100) if d["monthly_limit"] else 0
        d["overloaded"] = total_occupied >= int(d["monthly_limit"])
        months.append(d)

    # Детальный список слотов — только активные проекты (не archived/completed)
    where_archived = "" if show_archived else "WHERE s.status != 'archived'"
    cur.execute(f"""
        SELECT
            s.id, s.year, s.month, s.start_date, s.status, s.monthly_limit,
            s.deal_id,
            d.code AS deal_code,
            c.name AS client_name,
            p.id   AS project_id,
            p.code AS project_code,
            p.status AS project_status
        FROM {SCHEMA}.slots s
        LEFT JOIN {SCHEMA}.deals d ON d.id = s.deal_id AND d.is_archived = FALSE
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        LEFT JOIN {SCHEMA}.projects p ON p.slot_id = s.id AND p.status NOT IN ('archived', 'completed')
        {where_archived}
        ORDER BY s.start_date
    """)
    scols = [desc[0] for desc in cur.description]
    slots = [dict(zip(scols, r)) for r in cur.fetchall()]

    return {"months": months, "slots": slots}

def create_slots(cur, year: int, month: int, count: int, monthly_limit: int):
    """
    Создаёт слоты на выбранный месяц (каждую неделю).
    Если слот на эту дату уже существует — пропускает.
    """
    import calendar
    # Генерируем даты: первый понедельник месяца + каждые 7 дней, итого count штук
    first_day = date(year, month, 1)
    # Находим первый понедельник (или 1-е число если понедельник)
    weekday = first_day.weekday()
    if weekday != 0:
        first_monday = first_day + timedelta(days=(7 - weekday))
    else:
        first_monday = first_day

    created = []
    current = first_monday
    for i in range(count):
        if current.month != month:
            break
        # Проверяем — есть ли уже слот на эту дату
        cur.execute(f"""
            SELECT id FROM {SCHEMA}.slots WHERE start_date = %s
        """, (current,))
        if not cur.fetchone():
            cur.execute(f"""
                INSERT INTO {SCHEMA}.slots (year, month, start_date, status, monthly_limit)
                VALUES (%s, %s, %s, 'free', %s)
                RETURNING id
            """, (year, month, current, monthly_limit))
            new_id = cur.fetchone()[0]
            created.append({"id": new_id, "start_date": current.isoformat()})
        # Обновляем monthly_limit для всех слотов этого месяца
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET monthly_limit = %s
            WHERE year = %s AND month = %s
        """, (monthly_limit, year, month))
        current += timedelta(days=7)

    return {"created": created, "count": len(created)}


def delete_slot(cur, slot_id: int):
    """Удаляет слот если он свободен."""
    cur.execute(f"""
        SELECT id, status FROM {SCHEMA}.slots WHERE id = %s
    """, (slot_id,))
    row = cur.fetchone()
    if not row:
        return None, "Слот не найден"
    if row[1] != 'free':
        return None, "Нельзя удалить зарезервированный или занятый слот"
    cur.execute(f"DELETE FROM {SCHEMA}.slots WHERE id = %s", (slot_id,))
    return {"deleted": slot_id}, None


def get_deals(cur, archived=False):
    where = "WHERE d.is_archived = TRUE" if archived else "WHERE d.is_archived = FALSE"
    cur.execute(f"""
        SELECT d.id, d.code, d.stage, d.budget, d.start_date, d.source, d.notes, d.created_at,
               c.name as client_name, c.phone as client_phone,
               sm.name as manager_name, sr.name as realtor_name,
               sl.id as slot_id, sl.year as slot_year, sl.month as slot_month,
               sl.start_date as slot_start_date, sl.status as slot_status,
               d.project_id, d.project_type,
               sp.name as serial_project_name,
               cfg.name as configuration_name,
               cfg.duration_days as configuration_duration,
               cfg.price_coefficient,
               d.selected_stages, d.signed_date, d.buffer_days,
               d.kp_notes, d.address, d.planned_start_date,
               d.serial_project_id, d.configuration_id,
               COALESCE(d.contract_status, 'none') as contract_status,
               d.is_archived,
               COALESCE(d.kp_slot_id, 0) as kp_slot_id,
               COALESCE(d.payment_confirmed, false) as payment_confirmed,
               COALESCE(d.contract_signed, false) as contract_signed,
               ksl.start_date as kp_slot_start_date, ksl.year as kp_slot_year, ksl.month as kp_slot_month,
               d.client_token
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        LEFT JOIN {SCHEMA}.staff sm ON sm.id = d.manager_id
        LEFT JOIN {SCHEMA}.staff sr ON sr.id = d.realtor_id
        LEFT JOIN {SCHEMA}.slots sl ON sl.id = d.slot_id
        LEFT JOIN {SCHEMA}.slots ksl ON ksl.id = d.kp_slot_id
        LEFT JOIN {SCHEMA}.serial_projects sp ON sp.id = d.serial_project_id
        LEFT JOIN {SCHEMA}.configurations cfg ON cfg.id = d.configuration_id
        {where}
        ORDER BY d.created_at DESC
        LIMIT 100
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def get_stage_durations(cur):
    """Загружает нормативы этапов из БД (единый источник правды). Исключает деактивированные."""
    cur.execute(f"""
        SELECT stage_num, stage_name, duration_days, parallel_group, depends_on
        FROM {SCHEMA}.stage_durations
        WHERE stage_name NOT LIKE '_DISABLED_%%'
          AND duration_days > 0
        ORDER BY sort_order, stage_num
    """)
    result = []
    for row in cur.fetchall():
        result.append({
            "stage_num": row[0],
            "name": row[1],
            "duration": row[2],
            "parallel_group": row[3],
            "depends_on": list(row[4]) if row[4] else [],
        })
    return result

def recalc_active_projects_stages(cur) -> dict:
    """
    Пересчитывает planned_start / planned_end / duration_days во всех активных проектах
    (status IN ('active', 'planning')) на основе актуальных нормативов из stage_durations.

    Логика:
    - берём start_date проекта как точку отсчёта
    - для каждого этапа в project_stages обновляем duration_days из stage_durations
    - пересчитываем planned_start / planned_end через _build_plan_from_norms
    - этапы с actual_start (уже начаты) не сдвигаем по дате начала, но обновляем длительность
    - обновляем deadline проекта по максимальной planned_end
    """
    stage_norms = get_stage_durations(cur)
    norm_map = {s["stage_num"]: s for s in stage_norms}

    # Находим все активные проекты
    cur.execute(f"""
        SELECT id, start_date, status
        FROM {SCHEMA}.projects
        WHERE status IN ('active', 'planning')
        ORDER BY id
    """)
    projects = cur.fetchall()
    updated_projects = 0

    for proj_id, proj_start, _ in projects:
        if proj_start is None:
            continue
        start_dt = proj_start if isinstance(proj_start, date) else date.fromisoformat(str(proj_start))

        # Получаем этапы проекта
        cur.execute(f"""
            SELECT id, stage_num, order_num, actual_start, status
            FROM {SCHEMA}.project_stages
            WHERE project_id = %s
            ORDER BY order_num
        """, (proj_id,))
        stages = cur.fetchall()
        if not stages:
            continue

        # Собираем нормативы только для тех stage_num, которые есть в проекте
        included_nums = [s[1] for s in stages if s[1] is not None]
        if not included_nums:
            continue

        filtered_norms = [norm_map[n] for n in included_nums if n in norm_map]
        if not filtered_norms:
            continue

        # Строим новый Гант-план
        plan = _build_plan_from_norms(start_dt, filtered_norms)
        plan_map = {p[0]: p for p in plan}  # stage_num -> (snum, name, duration, ps, pe, ...)

        max_end = start_dt

        for stage_row in stages:
            stage_id, stage_num, order_num, actual_start, stage_status = stage_row
            if stage_num not in plan_map:
                continue

            p = plan_map[stage_num]
            new_duration = p[2]
            new_ps = p[3]
            new_pe = p[4]

            # Если этап уже идёт — сдвигаем только дату окончания (не трогаем начало)
            if actual_start is not None and stage_status in ('in_progress', 'done'):
                actual_dt = actual_start if isinstance(actual_start, date) else date.fromisoformat(str(actual_start))
                new_pe = actual_dt + timedelta(days=new_duration - 1)
                new_ps = actual_dt

            cur.execute(f"""
                UPDATE {SCHEMA}.project_stages
                SET duration_days = %s,
                    planned_start = %s,
                    planned_end   = %s,
                    updated_at    = now()
                WHERE id = %s
            """, (new_duration, new_ps, new_pe, stage_id))

            if new_pe > max_end:
                max_end = new_pe

        # Обновляем deadline проекта
        cur.execute(f"""
            UPDATE {SCHEMA}.projects
            SET deadline = %s, updated_at = now()
            WHERE id = %s
        """, (max_end, proj_id))
        updated_projects += 1

    return {"recalculated_projects": updated_projects}

def calc_duration_for_stages(stage_norms: list, included_nums: list, buffer_days: int = 7) -> int:
    """Считает итоговую длительность для выбранного набора этапов + буфер."""
    filtered = [s for s in stage_norms if s["stage_num"] in included_nums]
    if not filtered:
        return buffer_days
    # Строим план дат, берём максимальную дату завершения
    start = date(2000, 1, 1)
    plan = _build_plan_from_norms(start, filtered)
    if not plan:
        return buffer_days
    max_end = max(p[4] for p in plan)
    return (max_end - start).days + 1 + buffer_days

def _build_plan_from_norms(start_date: date, stage_norms: list) -> list:
    """Внутренняя: строит даты по нормативам из БД."""
    stage_map = {s["stage_num"]: s for s in stage_norms}
    end_dates = {}
    result = []
    for snum in sorted(stage_map.keys()):
        s = stage_map[snum]
        deps = [d for d in s["depends_on"] if d in end_dates]
        if deps:
            s_date = max(end_dates[d] for d in deps) + timedelta(days=1)
        else:
            s_date = start_date
        # Параллельная группа — все стартуют вместе
        if s["parallel_group"] is not None:
            group_starts = [r[3] for r in result if r[5] == s["parallel_group"]]
            if group_starts:
                s_date = min(group_starts)
        e_date = s_date + timedelta(days=s["duration"] - 1)
        end_dates[snum] = e_date
        result.append((snum, s["name"], s["duration"], s_date, e_date, s["parallel_group"], s["depends_on"]))
    return result

def create_deal(cur, body):
    """Создание нового лида — только базовые данные: клиент, тип проекта, источник."""
    client_id    = int(body["client_id"])
    manager_id   = int(body.get("manager_id", 1))
    realtor_id   = body.get("realtor_id")
    source       = body.get("source", "")
    notes        = body.get("notes", "")
    project_type = body.get("project_type", "serial")
    sp_id        = body.get("serial_project_id")
    address      = body.get("address", "")

    code = next_code(cur, "deals", "ЛД")
    realtor_val = int(realtor_id) if realtor_id else None
    sp_val      = int(sp_id) if sp_id else None

    cur.execute(f"""
        INSERT INTO {SCHEMA}.deals
            (code, client_id, manager_id, realtor_id, source, notes,
             stage, project_type, serial_project_id, address, start_date)
        VALUES (%s, %s, %s, %s, %s, %s, 'lead', %s, %s, %s, CURRENT_DATE)
        RETURNING id, code
    """, (code, client_id, manager_id, realtor_val, source, notes,
          project_type, sp_val, address))

    deal_id, deal_code = cur.fetchone()

    # Для индивидуального — сразу создаём карточку проектирования
    if project_type == 'individual':
        desired_area = float(body.get("desired_area", 0))
        spec_req = body.get("special_requests", "")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.individual_project_requests
                (deal_id, client_id, desired_area, special_requests, status)
            VALUES (%s, %s, %s, %s, 'awaiting_design')
        """, (deal_id, client_id, desired_area, spec_req))

    return {"id": deal_id, "code": deal_code, "project_type": project_type}, None

def update_deal_kp(cur, deal_id, body):
    """
    Заполнение данных на стадии КП:
    - серийный проект, комплектация / выбранные этапы, бюджет, буфер
    """
    cfg_id          = body.get("configuration_id")
    selected_stages = body.get("selected_stages")  # кастомный набор этапов
    budget          = body.get("budget")
    kp_notes        = body.get("kp_notes", "")
    buffer_days     = int(body.get("buffer_days", 7))
    sp_id           = body.get("serial_project_id")

    sets, vals = [], []
    if cfg_id is not None:
        sets.append("configuration_id=%s"); vals.append(int(cfg_id))
    if sp_id is not None:
        sets.append("serial_project_id=%s"); vals.append(int(sp_id))
    if selected_stages is not None:
        sets.append("selected_stages=%s"); vals.append(selected_stages)
    if budget is not None:
        sets.append("budget=%s"); vals.append(float(budget))
    if kp_notes:
        sets.append("kp_notes=%s"); vals.append(kp_notes)
    sets.append("buffer_days=%s"); vals.append(buffer_days)
    sets.append("stage='kp'")
    sets.append("updated_at=now()")
    vals.append(deal_id)

    cur.execute(f"UPDATE {SCHEMA}.deals SET {', '.join(sets)} WHERE id=%s RETURNING id, stage, budget, contractor_id", vals)
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
    # Получаем имя клиента для заголовка документа
    cur.execute(f"""
        SELECT d.code, c.name as client_name, d.contractor_id
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        WHERE d.id = %s
    """, (deal_id,))
    drow = cur.fetchone()
    if drow:
        auto_create_deal_documents(cur, deal_id, "kp", {
            "code": drow[0], "client_name": drow[1],
            "budget": row[2], "contractor_id": drow[2],
        })
    return {"id": row[0], "stage": row[1]}, None

def update_deal_contract(cur, deal_id, body):
    """
    Подписание договора:
    - слот, плановая дата начала, адрес, подтверждение бюджета
    - автоматически создаёт проект с этапами
    """
    slot_id         = body.get("slot_id")
    planned_start   = body.get("planned_start_date")
    address         = body.get("address", "")
    budget          = body.get("budget")
    signed_date     = body.get("signed_date") or date.today().isoformat()

    # Получаем сделку
    cur.execute(f"""
        SELECT id, client_id, project_type, configuration_id, selected_stages, buffer_days
        FROM {SCHEMA}.deals WHERE id=%s
    """, (deal_id,))
    deal_row = cur.fetchone()
    if not deal_row:
        return None, "Сделка не найдена"
    did, client_id, project_type, cfg_id, sel_stages, buf_days = deal_row
    buf_days = buf_days or 7

    sets, vals = [], []

    # Обрабатываем слот (только для серийных) — защита от двойного бронирования через SELECT FOR UPDATE
    actual_start = planned_start
    if project_type == 'serial' and slot_id:
        slot_id = int(slot_id)
        # SELECT FOR UPDATE блокирует строку до конца транзакции — защита от race condition
        cur.execute(f"""
            SELECT id, year, month, start_date, status, monthly_limit
            FROM {SCHEMA}.slots WHERE id=%s FOR UPDATE
        """, (slot_id,))
        slot_row = cur.fetchone()
        if not slot_row:
            return None, "Слот не найден"
        s_id, s_year, s_month, s_start_date, s_status, s_limit = slot_row
        if s_status != 'free':
            return None, "Слот уже занят или зарезервирован — выберите другой"
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.slots WHERE year=%s AND month=%s AND status IN ('booked','busy')", (s_year, s_month))
        if int(cur.fetchone()[0]) + 1 > s_limit:
            return None, f"Месяц перегружен (лимит {s_limit}). Выберите другой слот"
        # start_date = дата слота (без буфера — буфер только для display)
        slot_start = s_start_date if isinstance(s_start_date, date) else date.fromisoformat(str(s_start_date))
        actual_start = slot_start.isoformat()
        sets.append("slot_id=%s"); vals.append(slot_id)
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, slot_id))

    if actual_start:
        sets.append("planned_start_date=%s"); vals.append(actual_start)
    if address:
        sets.append("address=%s"); vals.append(address)
    if budget:
        sets.append("budget=%s"); vals.append(float(budget))
    sets.append("signed_date=%s");   vals.append(signed_date)
    sets.append("stage='contract'")  # Промежуточный статус — до создания проекта
    sets.append("updated_at=now()")
    vals.append(deal_id)

    cur.execute(f"UPDATE {SCHEMA}.deals SET {', '.join(sets)} WHERE id=%s", vals)

    # Автосоздание проекта
    start_for_project = actual_start or date.today().isoformat()
    project_id, perr = create_project_from_deal(cur, deal_id, client_id, start_for_project, slot_id)
    if perr:
        return None, perr

    # Если проект создан — переводим сделку в planning
    if project_id:
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET stage='planning', updated_at=now() WHERE id=%s
        """, (deal_id,))

    # Генерируем client_token если ещё нет
    cur.execute(f"SELECT client_token FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    row = cur.fetchone()
    if not row or not row[0]:
        token = "CL-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4)) + "-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        cur.execute(f"UPDATE {SCHEMA}.deals SET client_token=%s WHERE id=%s", (token, deal_id))
    else:
        token = row[0]

    return {"id": deal_id, "stage": "planning" if project_id else "contract", "project_id": project_id, "client_token": token}, None

def save_kp_slot(cur, deal_id: int, body: dict):
    """
    Шаг 1 КП: менеджер выбирает слот.
    Слот НЕ бронируется — только сохраняется как kp_slot_id.
    """
    kp_slot_id = body.get("kp_slot_id")
    if not kp_slot_id:
        return None, "Укажите слот"

    slot_id = int(kp_slot_id)
    # Проверяем что слот свободен
    cur.execute(f"SELECT id, status FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
    slot_row = cur.fetchone()
    if not slot_row:
        return None, "Слот не найден"
    if slot_row[1] not in ('free',):
        return None, "Слот уже занят или зарезервирован — выберите другой"

    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET kp_slot_id=%s, updated_at=now() WHERE id=%s RETURNING id
    """, (slot_id, deal_id))
    if not cur.fetchone():
        return None, "Сделка не найдена"
    return {"deal_id": deal_id, "kp_slot_id": slot_id}, None


def confirm_kp_contract(cur, deal_id: int):
    """
    Шаг 2 КП: менеджер отмечает что договор подписан.
    """
    cur.execute(f"""
        UPDATE {SCHEMA}.deals
        SET contract_signed=true, contract_signed_at=now(), signed_date=CURRENT_DATE, updated_at=now()
        WHERE id=%s AND kp_slot_id IS NOT NULL
        RETURNING id
    """, (deal_id,))
    if not cur.fetchone():
        return None, "Сначала выберите слот"
    return {"deal_id": deal_id, "contract_signed": True}, None


def confirm_kp_payment(cur, deal_id: int):
    """
    Шаг 3 КП: менеджер подтверждает оплату аванса.
    """
    cur.execute(f"""
        UPDATE {SCHEMA}.deals
        SET payment_confirmed=true, updated_at=now()
        WHERE id=%s AND contract_signed=true
        RETURNING id
    """, (deal_id,))
    if not cur.fetchone():
        return None, "Сначала отметьте договор как подписанный"
    return {"deal_id": deal_id, "payment_confirmed": True}, None


def move_to_planning(cur, deal_id: int, body: dict):
    """
    Шаг 4 КП: кнопка «Перевести в планирование».
    - слот (kp_slot_id) → booked (SELECT FOR UPDATE)
    - создаётся проект со статусом planning
    - сделка → stage=planning, slot_id=kp_slot_id
    Условие: contract_signed=true AND payment_confirmed=true
    """
    # Читаем сделку
    cur.execute(f"""
        SELECT d.id, d.client_id, d.project_type, d.kp_slot_id,
               d.contract_signed, d.payment_confirmed,
               d.configuration_id, d.selected_stages, d.buffer_days,
               d.address, d.budget
        FROM {SCHEMA}.deals d
        WHERE d.id=%s
    """, (deal_id,))
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
    (did, client_id, project_type, kp_slot_id,
     contract_signed, payment_confirmed,
     cfg_id, sel_stages, buf_days, address, budget) = row

    if not contract_signed:
        return None, "Договор не отмечен как подписанный"
    if not payment_confirmed:
        return None, "Оплата не подтверждена"
    if not kp_slot_id:
        return None, "Слот не выбран"

    buf_days = buf_days or 7

    # Блокируем слот через SELECT FOR UPDATE
    cur.execute(f"""
        SELECT id, year, month, start_date, status, monthly_limit
        FROM {SCHEMA}.slots WHERE id=%s FOR UPDATE
    """, (kp_slot_id,))
    slot_row = cur.fetchone()
    if not slot_row:
        return None, "Слот не найден"
    s_id, s_year, s_month, s_start_date, s_status, s_limit = slot_row

    if s_status != 'free':
        return None, "Слот уже занят — выберите другой в настройках КП"

    # Проверяем лимит месяца
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.slots WHERE year=%s AND month=%s AND status IN ('booked','busy')", (s_year, s_month))
    if int(cur.fetchone()[0]) + 1 > s_limit:
        return None, f"Месяц перегружен (лимит {s_limit})"

    # Бронируем слот
    cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, kp_slot_id))

    slot_start = s_start_date if isinstance(s_start_date, date) else date.fromisoformat(str(s_start_date))
    start_for_project = slot_start.isoformat()

    # Обновляем сделку: slot_id = kp_slot_id, planned_start_date
    cur.execute(f"""
        UPDATE {SCHEMA}.deals
        SET slot_id=%s, planned_start_date=%s, stage='contract', updated_at=now()
        WHERE id=%s
    """, (kp_slot_id, start_for_project, deal_id))

    # Создаём проект
    project_id, perr = create_project_from_deal(cur, deal_id, client_id, start_for_project, kp_slot_id)
    if perr:
        return None, perr

    # Переводим в planning
    if project_id:
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET stage='planning', updated_at=now() WHERE id=%s
        """, (deal_id,))

    return {"deal_id": deal_id, "stage": "planning", "project_id": project_id, "slot_id": kp_slot_id}, None


def update_deal_stage(cur, deal_id, new_stage, body=None):
    """Обобщённое изменение стадии (для lost и других простых переходов)."""
    body = body or {}

    if new_stage == "kp":
        return update_deal_kp(cur, deal_id, body)
    if new_stage == "contract":
        return update_deal_contract(cur, deal_id, body)

    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET stage=%s, updated_at=now() WHERE id=%s
        RETURNING id, stage
    """, (new_stage, deal_id))
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
    return {"id": row[0], "stage": row[1]}, None

# ─── PROJECTS ────────────────────────────────────────────────────────────────

def create_project_from_deal(cur, deal_id, client_id, start_date, slot_id):
    """Создаёт проект и этапы из сделки. Нормативы берутся из stage_durations."""
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)

    # Проверить — нет ли уже проекта
    cur.execute(f"SELECT id FROM {SCHEMA}.projects WHERE deal_id=%s", (deal_id,))
    ex = cur.fetchone()
    if ex:
        return ex[0], None

    # Получаем данные сделки
    cur.execute(f"""
        SELECT d.project_type, d.configuration_id, d.selected_stages,
               d.buffer_days, d.planned_start_date, d.address,
               cfg.included_stages as cfg_stages,
               d.serial_project_id
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.configurations cfg ON cfg.id = d.configuration_id
        WHERE d.id = %s
    """, (deal_id,))
    deal_row = cur.fetchone()
    if not deal_row:
        return None, "Сделка не найдена"

    project_type, cfg_id, sel_stages, buf_days, planned_start, address, cfg_stages, sp_id = deal_row
    buf_days = buf_days or 7

    # Для индивидуального проекта без сметы — не создаём автоматически
    if project_type == 'individual':
        return None, None

    # Определяем итоговый набор этапов
    # Приоритет: кастомный выбор → комплектация → все этапы
    if sel_stages:
        included_nums = list(sel_stages)
    elif cfg_stages:
        included_nums = list(cfg_stages)
    else:
        included_nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

    # Нормативы из БД — единый источник правды
    stage_norms = get_stage_durations(cur)
    filtered_norms = [s for s in stage_norms if s["stage_num"] in included_nums]

    # Плановая дата старта
    if planned_start:
        start_date = planned_start if isinstance(planned_start, date) else date.fromisoformat(str(planned_start))

    # Строим Гант-план
    stage_plan = _build_plan_from_norms(start_date, filtered_norms)
    if stage_plan:
        total_duration = (max(p[4] for p in stage_plan) - start_date).days + 1 + buf_days
    else:
        total_duration = 62 + buf_days

    deadline = start_date + timedelta(days=total_duration)
    code = next_code(cur, "projects", "ДОМ")

    cur.execute(f"""
        INSERT INTO {SCHEMA}.projects (code, deal_id, client_id, start_date, deadline, status, address, slot_id)
        VALUES (%s, %s, %s, %s, %s, 'planning', %s, %s)
        RETURNING id
    """, (code, deal_id, client_id, start_date, deadline, address or "", slot_id))
    project_id = cur.fetchone()[0]

    # Разворачиваем этапы
    for order_num, (snum, name, duration, ps, pe, par_group, deps) in enumerate(stage_plan, 1):
        cur.execute(f"""
            INSERT INTO {SCHEMA}.project_stages
                (project_id, name, order_num, stage_num, duration_days,
                 planned_start, planned_end, parallel_group, depends_on, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
        """, (project_id, name, order_num, snum, duration, ps, pe,
              par_group, deps if deps else None))

    # Слот остаётся 'booked' — станет 'busy' только после утверждения директором по строительству

    # Привязать project_id к сделке
    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET project_id=%s, updated_at=now()
        WHERE id=%s
    """, (project_id, deal_id))

    return project_id, None


def approve_project(cur, project_id: int):
    """
    Директор по строительству берёт проект в производство:
    - статус проекта: planning → active
    - статус слота: booked → busy
    """
    cur.execute(f"""
        SELECT p.id, p.status, p.slot_id, s.status as slot_status
        FROM {SCHEMA}.projects p
        LEFT JOIN {SCHEMA}.slots s ON s.id = p.slot_id
        WHERE p.id = %s
    """, (project_id,))
    row = cur.fetchone()
    if not row:
        return None, "Проект не найден"
    pid, pstatus, slot_id, slot_status = row
    if pstatus != 'planning':
        return None, "Проект уже в производстве или завершён"

    cur.execute(f"""
        UPDATE {SCHEMA}.projects SET status='active', updated_at=now() WHERE id=%s
    """, (project_id,))

    if slot_id and slot_status == 'booked':
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET status='busy' WHERE id=%s
        """, (slot_id,))

    return {"project_id": project_id, "status": "active"}, None


def cancel_project(cur, project_id: int):
    """
    Расторжение договора / отмена проекта:
    - проект → archived
    - слот → free (освобождается для других сделок)
    - сделка → lost
    """
    cur.execute(f"""
        SELECT p.id, p.status, p.slot_id, p.deal_id, s.status as slot_status
        FROM {SCHEMA}.projects p
        LEFT JOIN {SCHEMA}.slots s ON s.id = p.slot_id
        WHERE p.id = %s FOR UPDATE
    """, (project_id,))
    row = cur.fetchone()
    if not row:
        return None, "Проект не найден"
    pid, pstatus, slot_id, deal_id, slot_status = row

    if pstatus in ('archived', 'completed'):
        return None, "Проект уже архивирован или завершён"

    # Архивируем проект
    cur.execute(f"""
        UPDATE {SCHEMA}.projects SET status='archived', updated_at=now() WHERE id=%s
    """, (project_id,))

    # Освобождаем слот
    if slot_id and slot_status in ('booked', 'busy'):
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL WHERE id=%s
        """, (slot_id,))

    # Сделку переводим в lost
    if deal_id:
        cur.execute(f"""
            UPDATE {SCHEMA}.deals SET stage='lost', updated_at=now() WHERE id=%s
        """, (deal_id,))

    return {"project_id": project_id, "status": "archived", "slot_freed": bool(slot_id)}, None


def complete_project(cur, project_id: int):
    """
    Завершение проекта (сдан):
    - проект → completed
    - слот → archived (не влияет на загрузку, не удаляется)
    """
    cur.execute(f"""
        SELECT p.id, p.status, p.slot_id, s.status as slot_status
        FROM {SCHEMA}.projects p
        LEFT JOIN {SCHEMA}.slots s ON s.id = p.slot_id
        WHERE p.id = %s FOR UPDATE
    """, (project_id,))
    row = cur.fetchone()
    if not row:
        return None, "Проект не найден"
    pid, pstatus, slot_id, slot_status = row

    if pstatus not in ('active', 'planning'):
        return None, "Можно завершить только активный проект"

    cur.execute(f"""
        UPDATE {SCHEMA}.projects SET status='completed', updated_at=now() WHERE id=%s
    """, (project_id,))

    if slot_id:
        cur.execute(f"""
            UPDATE {SCHEMA}.slots SET status='archived' WHERE id=%s
        """, (slot_id,))

    return {"project_id": project_id, "status": "completed"}, None


def get_projects(cur, archived=False):
    where = "WHERE p.status = 'archived'" if archived else "WHERE p.status != 'archived'"
    cur.execute(f"""
        SELECT p.id, p.code, p.start_date, p.deadline, p.status, p.brigade, p.total_cost,
               c.name as client_name, c.phone as client_phone,
               p.address,
               (SELECT COUNT(*) FROM {SCHEMA}.project_stages ps WHERE ps.project_id=p.id) as total_stages,
               (SELECT COUNT(*) FROM {SCHEMA}.project_stages ps WHERE ps.project_id=p.id AND ps.status='done') as done_stages,
               d.code as deal_code, d.budget as deal_budget, d.signed_date, d.contract_status,
               sm.name as manager_name,
               sp.name as serial_project_name,
               cfg.name as configuration_name,
               p.slot_id,
               s.status as slot_status,
               s.start_date as slot_start_date
        FROM {SCHEMA}.projects p
        LEFT JOIN {SCHEMA}.clients c ON c.id = p.client_id
        LEFT JOIN {SCHEMA}.deals d ON d.id = p.deal_id
        LEFT JOIN {SCHEMA}.staff sm ON sm.id = d.manager_id
        LEFT JOIN {SCHEMA}.serial_projects sp ON sp.id = d.serial_project_id
        LEFT JOIN {SCHEMA}.configurations cfg ON cfg.id = d.configuration_id
        LEFT JOIN {SCHEMA}.slots s ON s.id = p.slot_id
        {where}
        ORDER BY p.created_at DESC
        LIMIT 50
    """)
    cols = [desc[0] for desc in cur.description]
    projects = [dict(zip(cols, row)) for row in cur.fetchall()]

    for proj in projects:
        cur.execute(f"""
            SELECT id, name, order_num, duration_days, planned_start, planned_end,
                   actual_start, actual_end, status
            FROM {SCHEMA}.project_stages WHERE project_id=%s ORDER BY order_num
        """, (proj["id"],))
        scols = [desc[0] for desc in cur.description]
        proj["stages"] = [dict(zip(scols, r)) for r in cur.fetchall()]

        total = proj["total_stages"] or 0
        done = proj["done_stages"] or 0
        proj["progress"] = int((done / total * 100) if total > 0 else 0)

        if proj["deadline"] and proj["start_date"]:
            today = date.today()
            dl = proj["deadline"] if isinstance(proj["deadline"], date) else date.fromisoformat(str(proj["deadline"]))
            proj["days_left"] = (dl - today).days

    return projects

# ─── PROCUREMENT ─────────────────────────────────────────────────────────────

def get_procurement(cur):
    cur.execute(f"""
        SELECT mr.id, mr.code, mr.material, mr.quantity, mr.unit, mr.required_date,
               mr.priority, mr.status, mr.notes, mr.created_at,
               p.code as project_code, f.name as foreman_name
        FROM {SCHEMA}.material_requests mr
        LEFT JOIN {SCHEMA}.projects p ON p.id = mr.project_id
        LEFT JOIN {SCHEMA}.staff f ON f.id = mr.foreman_id
        ORDER BY mr.created_at DESC LIMIT 50
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def create_material_request(cur, body):
    project_id = int(body["project_id"])
    material = body["material"]
    quantity = float(body.get("quantity", 1))
    unit = body.get("unit", "шт")
    required_date = body.get("required_date", (date.today() + timedelta(days=3)).isoformat())
    priority = body.get("priority", "normal")
    foreman_id = body.get("foreman_id")
    notes = body.get("notes", "")

    code = next_code(cur, "material_requests", "ЗМ")
    foreman_val = int(foreman_id) if foreman_id else None

    cur.execute(f"""
        INSERT INTO {SCHEMA}.material_requests
            (code, project_id, material, quantity, unit, required_date, priority, foreman_id, notes, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'new')
        RETURNING id, code
    """, (code, project_id, material, quantity, unit, required_date, priority, foreman_val, notes))
    rid, rcode = cur.fetchone()
    return {"id": rid, "code": rcode}

def update_request_status(cur, req_id, new_status):
    cur.execute(f"""
        UPDATE {SCHEMA}.material_requests SET status=%s, updated_at=now() WHERE id=%s RETURNING id
    """, (new_status, req_id))
    return bool(cur.fetchone())

# ─── CLIENT PORTAL ────────────────────────────────────────────────────────────

def get_client_portal(cur, token: str):
    """Возвращает данные ЛК клиента по токену."""
    cur.execute(f"""
        SELECT d.id, d.code, d.stage, d.budget,
               COALESCE(p.address, d.address) as address,
               d.signed_date,
               d.client_token, d.project_id,
               c.name as client_name, c.phone as client_phone,
               p.status as project_status, p.start_date, p.deadline, p.code as project_code
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        LEFT JOIN {SCHEMA}.projects p ON p.id = d.project_id
        WHERE d.client_token = %s
    """, (token,))
    row = cur.fetchone()
    if not row:
        return None
    cols = ["deal_id","deal_code","stage","budget","address","signed_date",
            "client_token","project_id","client_name","client_phone",
            "project_status","start_date","deadline","project_code"]
    deal = dict(zip(cols, row))

    # Этапы проекта
    stages = []
    today = date.today().isoformat()
    if deal["project_id"]:
        cur.execute(f"""
            SELECT id, name, order_num, planned_start, planned_end, actual_start, actual_end, status
            FROM {SCHEMA}.project_stages
            WHERE project_id = %s ORDER BY order_num, id
        """, (deal["project_id"],))
        scols = ["id","name","order_num","planned_start","planned_end","actual_start","actual_end","status"]
        rows = cur.fetchall()
        for r in rows:
            s = dict(zip(scols, r))
            # Вычисляем effective_status для фронтенда
            pe = s["planned_end"].isoformat() if s["planned_end"] else None
            if s["status"] == "done" or s["actual_end"]:
                s["effective_status"] = "done"
            elif s["status"] == "in_progress" or s["actual_start"]:
                s["effective_status"] = "in_progress"
                if pe and pe < today:
                    s["effective_status"] = "overdue"
            else:
                if pe and pe < today:
                    s["effective_status"] = "overdue"
                else:
                    s["effective_status"] = "pending"
            stages.append(s)

    # Акты
    cur.execute(f"""
        SELECT id, code, title, amount, status, signed_at, created_at
        FROM {SCHEMA}.client_acts WHERE deal_id = %s ORDER BY created_at
    """, (deal["deal_id"],))
    acols = ["id","code","title","amount","status","signed_at","created_at"]
    acts = [dict(zip(acols, r)) for r in cur.fetchall()]

    # Если нет актов и есть проект — создаём демо-акт по первому этапу
    if not acts and deal["project_id"] and stages:
        first_stage = stages[0]
        act_code = "АКТ-" + "".join(random.choices(string.digits, k=4))
        budget_val = float(deal["budget"] or 0)
        act_amount = round(budget_val * 0.3, 2) if budget_val > 0 else 0
        stage_name = first_stage.get("name", "Первый этап")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.client_acts
                (code, deal_id, project_id, stage_id, title, amount, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending_signature')
            RETURNING id, code, title, amount, status, signed_at, created_at
        """, (act_code, deal["deal_id"], deal["project_id"],
              first_stage["id"], f"Акт по этапу «{stage_name}»", act_amount))
        arow = cur.fetchone()
        acts = [dict(zip(acols, arow))]

    # Сумма оплат
    cur.execute(f"""
        SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.payments
        WHERE deal_id = %s AND type = 'income'
    """, (deal["deal_id"],))
    paid = float(cur.fetchone()[0] or 0)
    budget = float(deal["budget"] or 0)

    for d in [deal] + stages + acts:
        for k, v in d.items():
            if hasattr(v, 'isoformat'):
                d[k] = v.isoformat()

    return {
        "deal": deal,
        "stages": stages,
        "acts": acts,
        "paid": paid,
        "balance": round(budget - paid, 2),
        "budget": budget,
    }

def create_client_act(cur, project_id: int, stage_id: int, amount: float, title: str = ""):
    """Директор/прораб создаёт акт по этапу для подписания клиентом."""
    cur.execute(f"""
        SELECT d.id, ps.name, p.code
        FROM {SCHEMA}.projects p
        JOIN {SCHEMA}.deals d ON d.id = p.deal_id
        JOIN {SCHEMA}.project_stages ps ON ps.id = %s AND ps.project_id = p.id
        WHERE p.id = %s
    """, (stage_id, project_id))
    row = cur.fetchone()
    if not row:
        return None, "Проект или этап не найден"
    deal_id, stage_name, project_code = row
    act_title = title.strip() or f"Акт по этапу «{stage_name}»"
    act_code = "АКТ-" + "".join(random.choices(string.digits, k=4))
    cur.execute(f"""
        INSERT INTO {SCHEMA}.client_acts
            (code, deal_id, project_id, stage_id, title, amount, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'pending_signature')
        RETURNING id, code, title, amount, status, signed_at, created_at
    """, (act_code, deal_id, project_id, stage_id, act_title, amount))
    row = cur.fetchone()
    cols = ["id","code","title","amount","status","signed_at","created_at"]
    act = dict(zip(cols, row))
    for k, v in act.items():
        if hasattr(v, 'isoformat'):
            act[k] = v.isoformat()
    return act, None

def sign_client_act(cur, act_id: int):
    """Клиент подписывает акт → статус signed."""
    cur.execute(f"""
        UPDATE {SCHEMA}.client_acts
        SET status='signed', signed_at=now()
        WHERE id=%s AND status='pending_signature'
        RETURNING id, deal_id, amount, code
    """, (act_id,))
    row = cur.fetchone()
    if not row:
        return None, "Акт не найден или уже подписан"
    act_id, deal_id, amount, code = row

    # Создаём платёж-счёт (invoice) на следующий этап
    next_code = "".join(["СЧ-"] + ["".join(random.choices(string.digits, k=4))])
    cur.execute(f"""
        INSERT INTO {SCHEMA}.payments (code, deal_id, type, category, amount, payment_date, description)
        VALUES (%s, %s, 'income', 'По акту', %s, CURRENT_DATE, %s)
        RETURNING id
    """, (next_code, deal_id, float(amount), f"Счёт по акту {code}"))
    payment_id = cur.fetchone()[0]

    return {"ok": True, "act_id": act_id, "payment_id": payment_id}, None

def ensure_client_token(cur, deal_id: int) -> str:
    """Генерирует и сохраняет client_token если ещё нет."""
    cur.execute(f"SELECT client_token FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    row = cur.fetchone()
    if row and row[0]:
        return row[0]
    token = "CL-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4)) + "-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    cur.execute(f"UPDATE {SCHEMA}.deals SET client_token=%s WHERE id=%s", (token, deal_id))
    return token

# ─── PAYMENTS ────────────────────────────────────────────────────────────────

def get_payments(cur):
    cur.execute(f"""
        SELECT py.id, py.code, py.type, py.category, py.amount, py.payment_date, py.description,
               p.code as project_code, d.code as deal_code,
               s.name as created_by_name
        FROM {SCHEMA}.payments py
        LEFT JOIN {SCHEMA}.projects p ON p.id = py.project_id
        LEFT JOIN {SCHEMA}.deals d ON d.id = py.deal_id
        LEFT JOIN {SCHEMA}.staff s ON s.id = py.created_by
        ORDER BY py.payment_date DESC, py.created_at DESC LIMIT 50
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def create_payment(cur, body):
    project_id = body.get("project_id")
    deal_id = body.get("deal_id")
    pay_type = body["type"]  # income / expense
    category = body.get("category", "")
    amount = float(body["amount"])
    payment_date = body.get("payment_date", date.today().isoformat())
    description = body.get("description", "")
    created_by = body.get("created_by")

    code = next_code(cur, "payments", "ПЛТ")
    proj_val = int(project_id) if project_id else None
    deal_val = int(deal_id) if deal_id else None
    cb_val = int(created_by) if created_by else None

    cur.execute(f"""
        INSERT INTO {SCHEMA}.payments
            (code, project_id, deal_id, type, category, amount, payment_date, description, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, code
    """, (code, proj_val, deal_val, pay_type, category, amount, payment_date, description, cb_val))
    pid, pcode = cur.fetchone()
    return {"id": pid, "code": pcode, "amount": amount, "type": pay_type}

def get_pl_summary(cur):
    cur.execute(f"""
        SELECT
            type,
            category,
            SUM(amount) as total
        FROM {SCHEMA}.payments
        WHERE EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        GROUP BY type, category
        ORDER BY type, category
    """)
    cols = [desc[0] for desc in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    income = sum(r["total"] for r in rows if r["type"] == "income")
    expense = sum(r["total"] for r in rows if r["type"] == "expense")
    return {
        "income": float(income),
        "expense": float(expense),
        "profit": float(income - expense),
        "margin": round((income - expense) / income * 100, 1) if income > 0 else 0,
        "rows": rows
    }

# ─── K_COMPANY ───────────────────────────────────────────────────────────────

def calculate_kcompany(cur):
    # Нормативы
    cur.execute(f"SELECT key, value FROM {SCHEMA}.system_norms WHERE key IN ('sales_plan_month','houses_plan_month','build_days','k_company_alert')")
    norms = {r[0]: float(r[1]) for r in cur.fetchall()}
    sales_plan = norms.get("sales_plan_month", 20000000)
    houses_plan = norms.get("houses_plan_month", 4)
    norm_days = norms.get("build_days", 62)
    alert_threshold = norms.get("k_company_alert", 0.80)

    today = date.today()

    # Продажи факт (договоры этого месяца)
    cur.execute(f"""
        SELECT COALESCE(SUM(budget),0) FROM {SCHEMA}.deals
        WHERE stage='contract'
          AND EXTRACT(YEAR FROM start_date)=EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM start_date)=EXTRACT(MONTH FROM CURRENT_DATE)
    """)
    sales_fact = float(cur.fetchone()[0])

    # Сдано домов этого месяца
    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.projects
        WHERE status='done'
          AND EXTRACT(YEAR FROM updated_at)=EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM updated_at)=EXTRACT(MONTH FROM CURRENT_DATE)
    """)
    houses_fact = int(cur.fetchone()[0])

    # Средняя длительность завершённых домов
    cur.execute(f"""
        SELECT COALESCE(AVG(EXTRACT(DAY FROM (updated_at - created_at))),{norm_days})
        FROM {SCHEMA}.projects WHERE status='done'
    """)
    avg_duration = float(cur.fetchone()[0])
    if avg_duration <= 0:
        avg_duration = norm_days

    # Оборачиваемость (упрощённо: отношение платежей к нормативу)
    cur.execute(f"""
        SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.payments
        WHERE type='income'
          AND EXTRACT(YEAR FROM payment_date)=EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM payment_date)=EXTRACT(MONTH FROM CURRENT_DATE)
    """)
    turnover_fact = float(cur.fetchone()[0])
    turnover_norm = sales_plan

    k_sales = min((sales_fact / sales_plan), 1.0) if sales_plan > 0 else 0
    k_production = min((houses_fact / houses_plan), 1.0) if houses_plan > 0 else 0
    k_speed = min((norm_days / avg_duration), 1.0) if avg_duration > 0 else 0
    k_turnover = min((turnover_fact / turnover_norm), 1.0) if turnover_norm > 0 else 0

    k_total = round(k_sales * 0.4 + k_production * 0.3 + k_speed * 0.2 + k_turnover * 0.1, 4)

    # Сохранить в лог
    cur.execute(f"""
        INSERT INTO {SCHEMA}.k_company_log
            (calc_date, k_total, k_sales, k_production, k_speed, k_turnover,
             sales_fact, sales_plan, houses_fact, houses_plan, avg_duration_days, alert_sent)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, (today, k_total, round(k_sales,4), round(k_production,4), round(k_speed,4), round(k_turnover,4),
          sales_fact, sales_plan, houses_fact, int(houses_plan), round(avg_duration,2),
          k_total < alert_threshold))

    return {
        "date": today.isoformat(),
        "k_total": k_total,
        "k_sales": round(k_sales, 4),
        "k_production": round(k_production, 4),
        "k_speed": round(k_speed, 4),
        "k_turnover": round(k_turnover, 4),
        "sales_fact": sales_fact,
        "sales_plan": sales_plan,
        "houses_fact": houses_fact,
        "houses_plan": int(houses_plan),
        "avg_duration_days": round(avg_duration, 1),
        "alert": k_total < alert_threshold,
    }

def get_kcompany_last(cur):
    cur.execute(f"""
        SELECT calc_date, k_total, k_sales, k_production, k_speed, k_turnover,
               sales_fact, sales_plan, houses_fact, houses_plan, avg_duration_days, alert_sent
        FROM {SCHEMA}.k_company_log ORDER BY calc_date DESC LIMIT 1
    """)
    row = cur.fetchone()
    if not row:
        return None
    cols = ["calc_date","k_total","k_sales","k_production","k_speed","k_turnover",
            "sales_fact","sales_plan","houses_fact","houses_plan","avg_duration_days","alert_sent"]
    return dict(zip(cols, row))

# ─── DASHBOARD ───────────────────────────────────────────────────────────────

def get_dashboard(cur):
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.deals WHERE stage NOT IN ('lost','done')")
    active_deals = int(cur.fetchone()[0])

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.projects WHERE status='active'")
    active_projects = int(cur.fetchone()[0])

    cur.execute(f"""
        SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.payments
        WHERE type='income'
          AND EXTRACT(YEAR FROM payment_date)=EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM payment_date)=EXTRACT(MONTH FROM CURRENT_DATE)
    """)
    revenue_month = float(cur.fetchone()[0])

    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.material_requests WHERE status='new'
    """)
    pending_requests = int(cur.fetchone()[0])

    # K_company last
    k = get_kcompany_last(cur)

    return {
        "active_deals": active_deals,
        "active_projects": active_projects,
        "revenue_month": revenue_month,
        "pending_requests": pending_requests,
        "k_company": k,
    }

# ─── SERIAL PROJECTS & CONFIGURATIONS ────────────────────────────────────────

def get_serial_projects(cur):
    cur.execute(f"""
        SELECT sp.id, sp.name, sp.area_sqm, sp.base_price, sp.base_duration_days,
               sp.description, sp.is_active, sp.created_at,
               COUNT(cfg.id) AS config_count
        FROM {SCHEMA}.serial_projects sp
        LEFT JOIN {SCHEMA}.configurations cfg ON cfg.serial_project_id = sp.id AND cfg.is_active = TRUE
        WHERE sp.is_active = TRUE
        GROUP BY sp.id, sp.name, sp.area_sqm, sp.base_price, sp.base_duration_days,
                 sp.description, sp.is_active, sp.created_at
        ORDER BY sp.name
    """)
    cols = [desc[0] for desc in cur.description]
    projects = [dict(zip(cols, r)) for r in cur.fetchall()]
    # Нормативы для пересчёта duration_days комплектаций
    stage_norms = get_stage_durations(cur)
    for p in projects:
        cur.execute(f"""
            SELECT id, name, description, price_coefficient, duration_days, included_stages,
                   COALESCE(discount_pct, 0) as discount_pct,
                   discount_until,
                   COALESCE(is_popular, false) as is_popular
            FROM {SCHEMA}.configurations
            WHERE serial_project_id=%s AND is_active=TRUE
            ORDER BY price_coefficient
        """, (p["id"],))
        ccols = [desc[0] for desc in cur.description]
        cfgs = [dict(zip(ccols, r)) for r in cur.fetchall()]
        # Пересчитываем duration_days из актуальных нормативов
        for cfg in cfgs:
            included = list(cfg["included_stages"]) if cfg["included_stages"] else []
            if included:
                filtered = [s for s in stage_norms if s["stage_num"] in included]
                if filtered:
                    plan = _build_plan_from_norms(date(2000, 1, 1), filtered)
                    if plan:
                        max_end = max(pp[4] for pp in plan)
                        cfg["duration_days"] = (max_end - date(2000, 1, 1)).days + 1
        p["configurations"] = cfgs
    return projects

def get_configurations(cur, serial_project_id):
    """Возвращает комплектации. duration_days пересчитывается из актуальных нормативов stage_durations."""
    cur.execute(f"""
        SELECT id, name, description, price_coefficient, duration_days, included_stages,
               COALESCE(discount_pct, 0) as discount_pct,
               discount_until,
               COALESCE(is_popular, false) as is_popular
        FROM {SCHEMA}.configurations
        WHERE serial_project_id=%s AND is_active=TRUE
        ORDER BY price_coefficient
    """, (serial_project_id,))
    cols = [desc[0] for desc in cur.description]
    cfgs = [dict(zip(cols, r)) for r in cur.fetchall()]

    today = date.today()
    # Пересчитываем duration_days из актуальных нормативов (чтобы отражать изменения директора)
    stage_norms = get_stage_durations(cur)
    for cfg in cfgs:
        included = list(cfg["included_stages"]) if cfg["included_stages"] else []
        if included:
            filtered = [s for s in stage_norms if s["stage_num"] in included]
            if filtered:
                plan = _build_plan_from_norms(date(2000, 1, 1), filtered)
                if plan:
                    max_end = max(p[4] for p in plan)
                    cfg["duration_days"] = (max_end - date(2000, 1, 1)).days + 1
        # Если скидка истекла — не показываем
        du = cfg.get("discount_until")
        if du and du < today:
            cfg["discount_pct"] = 0
            cfg["discount_until"] = None
    return cfgs

def create_serial_project(cur, body):
    name  = body["name"]
    area  = float(body.get("area_sqm", 0))
    price = float(body["base_price"])
    dur   = int(body.get("base_duration_days", 62))
    desc  = body.get("description", "")
    cur.execute(f"""
        INSERT INTO {SCHEMA}.serial_projects (name, area_sqm, base_price, base_duration_days, description)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    """, (name, area, price, dur, desc))
    return {"id": cur.fetchone()[0]}

def create_configuration(cur, body):
    sp_id   = int(body["serial_project_id"])
    name    = body["name"]
    desc    = body.get("description", "")
    coeff   = float(body.get("price_coefficient", 1.0))
    dur     = int(body.get("duration_days", 62))
    stages  = body.get("included_stages", list(range(1, 12)))
    cur.execute(f"""
        INSERT INTO {SCHEMA}.configurations
            (serial_project_id, name, description, price_coefficient, duration_days, included_stages)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (sp_id, name, desc, coeff, dur, stages))
    return {"id": cur.fetchone()[0]}

def update_configuration(cur, cfg_id: int, body: dict):
    """Директор устанавливает скидку и/или популярную метку."""
    sets, vals = [], []
    if "discount_pct" in body:
        sets.append("discount_pct=%s"); vals.append(float(body["discount_pct"]))
    if "discount_until" in body:
        sets.append("discount_until=%s"); vals.append(body["discount_until"] or None)
    if "is_popular" in body:
        sets.append("is_popular=%s"); vals.append(bool(body["is_popular"]))
    if not sets:
        return {"ok": False}
    vals.append(cfg_id)
    cur.execute(f"UPDATE {SCHEMA}.configurations SET {', '.join(sets)} WHERE id=%s", vals)
    return {"id": cfg_id, "ok": True}

# ─── INDIVIDUAL PROJECT REQUESTS ─────────────────────────────────────────────

def get_individual_requests(cur):
    cur.execute(f"""
        SELECT ipr.id, ipr.deal_id, ipr.desired_area, ipr.special_requests,
               ipr.status, ipr.design_deadline, ipr.estimate_file_url,
               ipr.created_at, ipr.updated_at,
               c.name as client_name,
               d.code as deal_code
        FROM {SCHEMA}.individual_project_requests ipr
        LEFT JOIN {SCHEMA}.clients c ON c.id = ipr.client_id
        LEFT JOIN {SCHEMA}.deals d ON d.id = ipr.deal_id
        ORDER BY ipr.created_at DESC
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def update_individual_request(cur, req_id, body):
    status   = body.get("status")
    designer = body.get("assigned_designer_id")
    deadline = body.get("design_deadline")
    url      = body.get("estimate_file_url")
    sets, vals = [], []
    if status:   sets.append("status=%s");                  vals.append(status)
    if designer: sets.append("assigned_designer_id=%s");    vals.append(int(designer))
    if deadline: sets.append("design_deadline=%s");         vals.append(deadline)
    if url:      sets.append("estimate_file_url=%s");       vals.append(url)
    if not sets:
        return False
    sets.append("updated_at=now()")
    vals.append(req_id)
    cur.execute(f"UPDATE {SCHEMA}.individual_project_requests SET {', '.join(sets)} WHERE id=%s", vals)
    return True

# ─── SLOT PLAN (управление лимитами) ─────────────────────────────────────────

def update_slot_limit(cur, year, month, new_limit):
    """Обновляет monthly_limit для всех слотов указанного месяца."""
    cur.execute(f"""
        UPDATE {SCHEMA}.slots SET monthly_limit=%s
        WHERE year=%s AND month=%s
    """, (int(new_limit), int(year), int(month)))
    return {"year": year, "month": month, "monthly_limit": new_limit}

# ─── ESTIMATE: WORKS & MATERIALS ─────────────────────────────────────────────

def get_estimate(cur, serial_project_id: int):
    """Возвращает полную смету проекта: работы + материалы по этапам."""
    # Нормативы этапов
    cur.execute(f"""
        SELECT stage_num, stage_name FROM {SCHEMA}.stage_durations
        WHERE stage_name NOT LIKE '_DISABLED_%%'
        ORDER BY sort_order, stage_num
    """)
    stages = {r[0]: r[1] for r in cur.fetchall()}

    # Работы
    cur.execute(f"""
        SELECT id, stage_num, work_name, unit, quantity, unit_price, notes, sort_order
        FROM {SCHEMA}.stage_works
        WHERE serial_project_id = %s
        ORDER BY stage_num, sort_order, id
    """, (serial_project_id,))
    wcols = [d[0] for d in cur.description]
    works = [dict(zip(wcols, r)) for r in cur.fetchall()]

    # Материалы
    cur.execute(f"""
        SELECT id, stage_num, material_name, unit, quantity, unit_price, supplier_hint, notes, sort_order
        FROM {SCHEMA}.stage_materials
        WHERE serial_project_id = %s
        ORDER BY stage_num, sort_order, id
    """, (serial_project_id,))
    mcols = [d[0] for d in cur.description]
    materials = [dict(zip(mcols, r)) for r in cur.fetchall()]

    # Группируем по этапам
    result = []
    for snum, sname in sorted(stages.items()):
        stage_works = [w for w in works if w["stage_num"] == snum]
        stage_mats  = [m for m in materials if m["stage_num"] == snum]
        works_total = sum(float(w["quantity"]) * float(w["unit_price"]) for w in stage_works)
        mats_total  = sum(float(m["quantity"]) * float(m["unit_price"]) for m in stage_mats)
        result.append({
            "stage_num":    snum,
            "stage_name":   sname,
            "works":        stage_works,
            "materials":    stage_mats,
            "works_total":  works_total,
            "mats_total":   mats_total,
            "stage_total":  works_total + mats_total,
        })

    grand_works = sum(float(w["unit_price"]) * float(w["quantity"]) for w in works)
    grand_mats  = sum(float(m["unit_price"]) * float(m["quantity"]) for m in materials)
    return {
        "stages": result,
        "total_works": grand_works,
        "total_materials": grand_mats,
        "grand_total": grand_works + grand_mats,
    }

def upsert_estimate_row(cur, table: str, body: dict):
    """Создаёт или обновляет строку сметы (работа или материал)."""
    row_id = body.get("id")
    sp_id  = int(body["serial_project_id"])
    snum   = int(body["stage_num"])
    sort   = int(body.get("sort_order", 0))

    if table == "stage_works":
        name  = body["work_name"]
        unit  = body.get("unit", "шт")
        qty   = float(body.get("quantity", 0))
        price = float(body.get("unit_price", 0))
        notes = body.get("notes", "")
        if row_id:
            cur.execute(f"""
                UPDATE {SCHEMA}.stage_works
                SET work_name=%s, unit=%s, quantity=%s, unit_price=%s, notes=%s, sort_order=%s, updated_at=now()
                WHERE id=%s AND serial_project_id=%s
                RETURNING id
            """, (name, unit, qty, price, notes, sort, int(row_id), sp_id))
        else:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.stage_works
                    (serial_project_id, stage_num, work_name, unit, quantity, unit_price, notes, sort_order)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (sp_id, snum, name, unit, qty, price, notes, sort))
    else:  # stage_materials
        name     = body["material_name"]
        unit     = body.get("unit", "шт")
        qty      = float(body.get("quantity", 0))
        price    = float(body.get("unit_price", 0))
        supplier = body.get("supplier_hint", "")
        notes    = body.get("notes", "")
        if row_id:
            cur.execute(f"""
                UPDATE {SCHEMA}.stage_materials
                SET material_name=%s, unit=%s, quantity=%s, unit_price=%s, supplier_hint=%s, notes=%s, sort_order=%s, updated_at=now()
                WHERE id=%s AND serial_project_id=%s
                RETURNING id
            """, (name, unit, qty, price, supplier, notes, sort, int(row_id), sp_id))
        else:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.stage_materials
                    (serial_project_id, stage_num, material_name, unit, quantity, unit_price, supplier_hint, notes, sort_order)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (sp_id, snum, name, unit, qty, price, supplier, notes, sort))
    row = cur.fetchone()
    return {"id": row[0]} if row else {"id": None}

# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

def create_notification(cur, type_: str, title: str, body_text: str = "",
                        role: str = None, staff_id: int = None, deal_id: int = None):
    cur.execute(f"""
        INSERT INTO {SCHEMA}.notifications (type, title, body, role, staff_id, deal_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (type_, title, body_text, role, staff_id, deal_id))
    return cur.fetchone()[0]

def get_notifications(cur, role: str = None, staff_id: int = None, unread_only: bool = False):
    wheres, vals = ["1=1"], []
    if role:
        wheres.append("(n.role=%s OR n.role IS NULL)"); vals.append(role)
    if staff_id:
        wheres.append("(n.staff_id=%s OR n.staff_id IS NULL)"); vals.append(staff_id)
    if unread_only:
        wheres.append("n.is_read=FALSE")
    cur.execute(f"""
        SELECT n.id, n.type, n.title, n.body, n.role, n.staff_id,
               n.deal_id, n.is_read, n.created_at,
               d.code as deal_code
        FROM {SCHEMA}.notifications n
        LEFT JOIN {SCHEMA}.deals d ON d.id = n.deal_id
        WHERE {' AND '.join(wheres)}
        ORDER BY n.created_at DESC
        LIMIT 50
    """, vals)
    cols = [x[0] for x in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def mark_notifications_read(cur, notif_ids: list):
    if not notif_ids:
        return
    placeholders = ",".join(["%s"] * len(notif_ids))
    cur.execute(f"UPDATE {SCHEMA}.notifications SET is_read=TRUE WHERE id IN ({placeholders})", notif_ids)

def get_unread_count(cur, role: str = None, staff_id: int = None):
    wheres, vals = ["is_read=FALSE"], []
    if role:
        wheres.append("(role=%s OR role IS NULL)"); vals.append(role)
    if staff_id:
        wheres.append("(staff_id=%s OR staff_id IS NULL)"); vals.append(staff_id)
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.notifications WHERE {' AND '.join(wheres)}", vals)
    return int(cur.fetchone()[0])

# ─── S3 HELPER ───────────────────────────────────────────────────────────────

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def upload_file_to_s3(file_b64: str, file_name: str, folder: str = "documents") -> tuple:
    """Декодирует base64, заливает в S3, возвращает (cdn_url, size_kb)."""
    s3 = get_s3()
    data = base64.b64decode(file_b64)
    # Определяем Content-Type по расширению
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    content_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png",
    }
    ct = content_types.get(ext, "application/octet-stream")
    key = f"{folder}/{file_name}"
    s3.put_object(Bucket="files", Key=key, Body=data, ContentType=ct)
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    size_kb = len(data) // 1024
    return cdn_url, size_kb

# ─── DOC TEMPLATES (пакет документов по договору) ────────────────────────────

def get_doc_templates(cur, active_only: bool = True):
    """Список шаблонов документов (управляет директор)."""
    where = "WHERE is_active = TRUE" if active_only else ""
    cur.execute(f"""
        SELECT id, name, description, is_required, sort_order,
               file_url, file_name, file_size_kb, file_updated_at,
               is_active, created_at, version, prev_file_url, prev_file_name
        FROM {SCHEMA}.doc_templates
        {where}
        ORDER BY sort_order, id
    """)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def update_doc_template(cur, tpl_id: int, body: dict):
    """Директор обновляет метаданные шаблона (или загружает новый файл)."""
    sets, vals = [], []
    for field in ["name", "description", "is_required", "sort_order", "is_active"]:
        if field in body:
            sets.append(f"{field}=%s"); vals.append(body[field])
    # Если передан файл — заливаем в S3, старый файл сохраняем как prev
    file_b64 = body.get("file_b64")
    file_name = body.get("file_name")
    if file_b64 and file_name:
        # Сохраняем старый URL как prev_file
        cur.execute(f"SELECT file_url, file_name, version FROM {SCHEMA}.doc_templates WHERE id=%s", (tpl_id,))
        old = cur.fetchone()
        cdn_url, size_kb = upload_file_to_s3(file_b64, f"template_{tpl_id}_{file_name}", "doc_templates")
        sets += ["file_url=%s", "file_name=%s", "file_size_kb=%s", "file_updated_at=now()",
                 "version=version+1",
                 "prev_file_url=%s", "prev_file_name=%s"]
        vals += [cdn_url, file_name, size_kb, old[0] if old else None, old[1] if old else None]
    if not sets:
        return False
    sets.append("updated_at=now()")
    vals.append(tpl_id)
    cur.execute(f"UPDATE {SCHEMA}.doc_templates SET {', '.join(sets)} WHERE id=%s", vals)
    return True

def create_doc_template(cur, body: dict):
    """Директор создаёт новый шаблон."""
    name      = body["name"]
    desc      = body.get("description", "")
    required  = bool(body.get("is_required", True))
    sort      = int(body.get("sort_order", 99))
    cur.execute(f"""
        INSERT INTO {SCHEMA}.doc_templates (name, description, is_required, sort_order)
        VALUES (%s,%s,%s,%s) RETURNING id
    """, (name, desc, required, sort))
    tpl_id = cur.fetchone()[0]
    # Если сразу передан файл
    file_b64 = body.get("file_b64")
    file_name = body.get("file_name")
    if file_b64 and file_name:
        cdn_url, size_kb = upload_file_to_s3(file_b64, f"template_{tpl_id}_{file_name}", "doc_templates")
        cur.execute(f"""
            UPDATE {SCHEMA}.doc_templates
            SET file_url=%s, file_name=%s, file_size_kb=%s, file_updated_at=now()
            WHERE id=%s
        """, (cdn_url, file_name, size_kb, tpl_id))
    return {"id": tpl_id, "name": name}

# ─── CONTRACT DOCUMENTS (пакет по конкретной сделке) ─────────────────────────

def get_contract_docs(cur, deal_id: int):
    """
    Возвращает статус пакета документов по сделке:
    все шаблоны + загружены ли файлы менеджером + подписанные директором.
    """
    # Все активные шаблоны
    templates = get_doc_templates(cur, active_only=True)
    # Уже загруженные для этой сделки
    cur.execute(f"""
        SELECT id, template_id, file_url, file_name, file_size_kb,
               uploaded_at, status, notes,
               signed_file_url, signed_file_name, signed_at,
               payment_confirmed, manager_seen_signed
        FROM {SCHEMA}.contract_documents
        WHERE deal_id = %s
    """, (deal_id,))
    cols = [d[0] for d in cur.description]
    uploaded = {r[1]: dict(zip(cols, r)) for r in cur.fetchall()}

    result = []
    for tpl in templates:
        doc = uploaded.get(tpl["id"])
        result.append({
            "template_id":   tpl["id"],
            "template_name": tpl["name"],
            "description":   tpl["description"],
            "is_required":   tpl["is_required"],
            "sort_order":    tpl["sort_order"],
            "template_version": tpl.get("version", 1),
            # Шаблон для скачивания
            "template_file_url":  tpl["file_url"],
            "template_file_name": tpl["file_name"],
            # Загруженный менеджером файл
            "doc_id":     doc["id"]        if doc else None,
            "file_url":   doc["file_url"]  if doc else None,
            "file_name":  doc["file_name"] if doc else None,
            "status":     doc["status"]    if doc else "pending",
            "uploaded_at":doc["uploaded_at"] if doc else None,
            # Подписанный директором вариант
            "signed_file_url":  doc["signed_file_url"]  if doc else None,
            "signed_file_name": doc["signed_file_name"] if doc else None,
            "signed_at":        doc["signed_at"]         if doc else None,
            "manager_seen_signed": doc["manager_seen_signed"] if doc else False,
        })

    all_required_uploaded = all(
        r["status"] in ("uploaded", "approved", "review")
        for r in result if r["is_required"]
    )
    return {
        "items": result,
        "all_required_done": all_required_uploaded,
        "total": len(result),
        "uploaded_count": sum(1 for r in result if r["status"] != "pending"),
    }

def upload_contract_doc(cur, deal_id: int, template_id: int, body: dict):
    """Менеджер загружает подписанный скан документа."""
    file_b64  = body["file_b64"]
    file_name = body["file_name"]
    notes     = body.get("notes", "")

    cdn_url, size_kb = upload_file_to_s3(
        file_b64,
        f"deal_{deal_id}_tpl_{template_id}_{file_name}",
        "contract_docs"
    )

    # Upsert — если уже было, обновляем
    cur.execute(f"""
        INSERT INTO {SCHEMA}.contract_documents
            (deal_id, template_id, file_url, file_name, file_size_kb, uploaded_at, status, notes)
        VALUES (%s, %s, %s, %s, %s, now(), 'uploaded', %s)
        ON CONFLICT (deal_id, template_id) DO UPDATE SET
            file_url = EXCLUDED.file_url,
            file_name = EXCLUDED.file_name,
            file_size_kb = EXCLUDED.file_size_kb,
            uploaded_at = now(),
            status = 'uploaded',
            notes = EXCLUDED.notes
        RETURNING id
    """, (deal_id, template_id, cdn_url, file_name, size_kb, notes))
    doc_id = cur.fetchone()[0]

    # Автоматически создаём/обновляем запись в таблице documents
    cur.execute(f"""
        SELECT name FROM {SCHEMA}.doc_templates WHERE id=%s
    """, (template_id,))
    tpl_row = cur.fetchone()
    tpl_name = tpl_row[0] if tpl_row else "Документ"

    cur.execute(f"""
        SELECT d.code, c.name FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        WHERE d.id = %s
    """, (deal_id,))
    deal_row = cur.fetchone()
    deal_code   = deal_row[0] if deal_row else ""
    client_name = deal_row[1] if deal_row else ""

    # Обновляем или создаём запись в общем архиве документов
    cur.execute(f"""
        INSERT INTO {SCHEMA}.documents
            (doc_type, category, title, status, deal_id, file_url, file_name, file_size_kb)
        VALUES ('deal_contract', 'deal', %s, 'signed', %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
    """, (f"{tpl_name} — {client_name} ({deal_code})",
          deal_id, cdn_url, file_name, size_kb))

    return {"doc_id": doc_id, "file_url": cdn_url, "file_name": file_name}

def submit_docs_for_review(cur, deal_id: int):
    """
    Менеджер отправляет пакет документов на проверку директору (шаг 2→3).
    Устанавливает статус пакета 'docs_review', уведомляет директора.
    """
    # Проверяем что все обязательные загружены
    pkg = get_contract_docs(cur, deal_id)
    if not pkg["all_required_done"]:
        return None, "Загрузите все обязательные документы перед отправкой"

    # Переводим все uploaded → review
    cur.execute(f"""
        UPDATE {SCHEMA}.contract_documents
        SET status='review'
        WHERE deal_id=%s AND status='uploaded'
    """, (deal_id,))

    # Обновляем статус сделки
    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET contract_status='docs_review', updated_at=now() WHERE id=%s
        RETURNING code, client_id
    """, (deal_id,))
    row = cur.fetchone()
    deal_code = row[0] if row else ""

    # Уведомление директору
    create_notification(cur,
        type_="docs_for_review",
        title=f"Документы на проверку: {deal_code}",
        body_text="Менеджер загрузил пакет документов и ожидает проверки.",
        role="director",
        deal_id=deal_id,
    )
    return {"deal_id": deal_id, "contract_status": "docs_review"}, None

def approve_docs(cur, deal_id: int, approved: bool, reject_reason: str = ""):
    """
    Директор подтверждает или отклоняет документы (шаг 3).
    approved=True → статус 'docs_approved' + уведомление менеджеру.
    approved=False → статус 'docs_rejected' + причина отклонения.
    """
    new_doc_status = "approved" if approved else "rejected"
    new_deal_status = "docs_approved" if approved else "docs_uploaded"

    cur.execute(f"""
        UPDATE {SCHEMA}.contract_documents
        SET status=%s, reviewed_at=now(), reject_reason=%s
        WHERE deal_id=%s AND status='review'
    """, (new_doc_status, reject_reason or None, deal_id))

    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET contract_status=%s, updated_at=now() WHERE id=%s
        RETURNING code
    """, (new_deal_status, deal_id))
    deal_code = (cur.fetchone() or [""])[0]

    # Находим менеджера сделки
    cur.execute(f"SELECT manager_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    manager_row = cur.fetchone()

    if approved:
        create_notification(cur,
            type_="docs_approved",
            title=f"Документы подтверждены: {deal_code}",
            body_text="Директор подтвердил документы. Переходите к ожиданию оплаты.",
            role="crm_manager",
            staff_id=manager_row[0] if manager_row else None,
            deal_id=deal_id,
        )
    else:
        create_notification(cur,
            type_="docs_rejected",
            title=f"Документы отклонены: {deal_code}",
            body_text=f"Причина: {reject_reason}. Исправьте и загрузите повторно.",
            role="crm_manager",
            staff_id=manager_row[0] if manager_row else None,
            deal_id=deal_id,
        )
    return {"deal_id": deal_id, "contract_status": new_deal_status, "approved": approved}, None

def set_payment_pending(cur, deal_id: int):
    """
    Переводим сделку в ожидание оплаты (шаг 3→4).
    Вызывается директором после approve_docs или отдельно.
    """
    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET contract_status='payment_pending', updated_at=now() WHERE id=%s
        RETURNING code, manager_id
    """, (deal_id,))
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
    deal_code, manager_id = row

    create_notification(cur,
        type_="payment_pending",
        title=f"Ожидание оплаты: {deal_code}",
        body_text="Документы подтверждены. Ожидайте поступления оплаты от заказчика.",
        role="crm_manager",
        staff_id=manager_id,
        deal_id=deal_id,
    )
    return {"deal_id": deal_id, "contract_status": "payment_pending"}, None

def confirm_payment(cur, deal_id: int):
    """
    Директор подтверждает оплату:
    - слот (kp_slot_id) → booked (SELECT FOR UPDATE)
    - создаётся проект со статусом planning
    - сделка → stage=planning, contract_status=payment_confirmed
    Автоматически, без кнопки «Перевести в планирование» у менеджера.
    """
    cur.execute(f"""
        SELECT d.id, d.client_id, d.kp_slot_id, d.code, d.manager_id,
               d.configuration_id, d.selected_stages, d.buffer_days,
               d.address, d.budget, d.project_id
        FROM {SCHEMA}.deals d
        WHERE d.id=%s
    """, (deal_id,))
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
    (did, client_id, kp_slot_id, deal_code, manager_id,
     cfg_id, sel_stages, buf_days, address, budget, existing_project_id) = row

    if not kp_slot_id:
        return None, "Слот не выбран — невозможно подтвердить оплату"

    # Блокируем и проверяем слот
    cur.execute(f"""
        SELECT id, year, month, start_date, status, monthly_limit
        FROM {SCHEMA}.slots WHERE id=%s FOR UPDATE
    """, (kp_slot_id,))
    slot_row = cur.fetchone()
    if not slot_row:
        return None, "Слот не найден"
    s_id, s_year, s_month, s_start_date, s_status, s_limit = slot_row

    if s_status not in ('free',):
        return None, "Слот уже занят — выберите другой в настройках КП"

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.slots WHERE year=%s AND month=%s AND status IN ('booked','busy')", (s_year, s_month))
    if int(cur.fetchone()[0]) + 1 > s_limit:
        return None, f"Месяц перегружен (лимит {s_limit})"

    # Бронируем слот
    cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, kp_slot_id))

    slot_start = s_start_date if isinstance(s_start_date, date) else date.fromisoformat(str(s_start_date))
    start_for_project = slot_start.isoformat()

    # Обновляем сделку: слот, дата начала, статус контракта
    cur.execute(f"""
        UPDATE {SCHEMA}.deals
        SET contract_status='payment_confirmed', payment_confirmed=true,
            slot_id=%s, planned_start_date=%s, updated_at=now()
        WHERE id=%s
    """, (kp_slot_id, start_for_project, deal_id))

    # Создаём проект если ещё не создан
    project_id = existing_project_id
    if not project_id:
        project_id, perr = create_project_from_deal(cur, deal_id, client_id, start_for_project, kp_slot_id)
        if perr:
            return None, perr

    # Переводим сделку в planning
    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET stage='planning', updated_at=now() WHERE id=%s
    """, (deal_id,))

    create_notification(cur,
        type_="payment_confirmed",
        title=f"Оплата подтверждена: {deal_code}",
        body_text="Оплата получена! Проект автоматически создан в разделе «Строительство».",
        role="crm_manager",
        staff_id=manager_id,
        deal_id=deal_id,
    )
    create_notification(cur,
        type_="payment_confirmed",
        title=f"Новый проект готов к производству: {deal_code}",
        body_text="Оплата подтверждена, проект создан. Нажмите «Взять в производство».",
        role="construction_director",
        deal_id=deal_id,
    )
    return {"deal_id": deal_id, "contract_status": "payment_confirmed", "stage": "planning", "project_id": project_id, "slot_id": kp_slot_id}, None

def upload_signed_doc(cur, deal_id: int, template_id: int, body: dict):
    """Директор загружает подписанный вариант документа. UPSERT — создаёт запись если нет."""
    file_b64  = body["file_b64"]
    file_name = body["file_name"]

    cdn_url, size_kb = upload_file_to_s3(
        file_b64,
        f"deal_{deal_id}_signed_{template_id}_{file_name}",
        "contract_docs"
    )

    # UPSERT: если запись менеджера есть — обновляем signed_*, если нет — создаём новую
    cur.execute(f"""
        INSERT INTO {SCHEMA}.contract_documents
            (deal_id, template_id, signed_file_url, signed_file_name, signed_at, status, manager_seen_signed)
        VALUES (%s, %s, %s, %s, now(), 'review', false)
        ON CONFLICT (deal_id, template_id) DO UPDATE SET
            signed_file_url    = EXCLUDED.signed_file_url,
            signed_file_name   = EXCLUDED.signed_file_name,
            signed_at          = now(),
            manager_seen_signed = false
        RETURNING id
    """, (deal_id, template_id, cdn_url, file_name))
    row = cur.fetchone()
    if not row:
        return None, "Ошибка сохранения документа"

    # Уведомляем менеджера
    cur.execute(f"SELECT code, manager_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    deal_row = cur.fetchone()
    if deal_row:
        deal_code, manager_id = deal_row
        create_notification(cur,
            type_="docs_signed_returned",
            title=f"Подписанный документ готов: {deal_code}",
            body_text="Директор подписал документы. Скачайте подписанные варианты.",
            role="crm_manager",
            staff_id=manager_id,
            deal_id=deal_id,
        )
    return {"doc_id": row[0], "signed_file_url": cdn_url}, None

def confirm_doc_payment(cur, deal_id: int, template_id: int):
    """Директор нажимает 'Оплата прошла' у конкретного документа."""
    cur.execute(f"""
        UPDATE {SCHEMA}.contract_documents
        SET payment_confirmed=true
        WHERE deal_id=%s AND template_id=%s
        RETURNING id
    """, (deal_id, template_id))
    if not cur.fetchone():
        return None, "Документ не найден"
    return {"ok": True}, None

def get_payout_deals(cur, manager_id: int = None):
    """Сделки с подтверждённой оплатой для заявок на вознаграждение."""
    where_mgr = f"AND d.manager_id = {int(manager_id)}" if manager_id else ""
    cur.execute(f"""
        SELECT d.id, d.code, d.budget, d.contract_status, d.signed_date,
               c.name AS client_name, c.phone AS client_phone,
               s.name AS manager_name,
               sp.name AS serial_project_name,
               d.project_id,
               pr.id AS payout_id, pr.status AS payout_status,
               pr.amount AS payout_amount, pr.requested_at, pr.notes,
               pr.invoice_file_url, pr.invoice_file_name, pr.reject_comment
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        LEFT JOIN {SCHEMA}.staff s ON s.id = d.manager_id
        LEFT JOIN {SCHEMA}.serial_projects sp ON sp.id = d.serial_project_id
        LEFT JOIN {SCHEMA}.payout_requests pr ON pr.deal_id = d.id
            AND (pr.manager_id = d.manager_id)
        WHERE d.contract_status = 'payment_confirmed'
        {where_mgr}
        ORDER BY d.updated_at DESC
    """)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def create_payout_request(cur, deal_id: int, manager_id: int, body: dict):
    """Менеджер подаёт заявку на выплату вознаграждения (со счётом)."""
    amount    = body.get("amount")
    notes     = body.get("notes", "")
    file_b64  = body.get("invoice_file_b64")
    file_name = body.get("invoice_file_name")

    # Проверяем что нет активной заявки
    cur.execute(f"""
        SELECT id FROM {SCHEMA}.payout_requests
        WHERE deal_id=%s AND manager_id=%s AND status NOT IN ('rejected')
    """, (deal_id, manager_id))
    if cur.fetchone():
        return None, "Заявка по этой сделке уже подана"

    invoice_url = None
    if file_b64 and file_name:
        invoice_url, _ = upload_file_to_s3(file_b64, f"invoice_{deal_id}_{file_name}", "payouts")

    cur.execute(f"""
        INSERT INTO {SCHEMA}.payout_requests (deal_id, manager_id, amount, notes, status, invoice_file_url, invoice_file_name)
        VALUES (%s, %s, %s, %s, 'pending', %s, %s)
        RETURNING id
    """, (deal_id, manager_id, amount, notes, invoice_url, file_name if file_b64 else None))
    payout_id = cur.fetchone()[0]

    # Уведомляем директора
    cur.execute(f"SELECT code FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    deal_code = (cur.fetchone() or [""])[0]
    create_notification(cur,
        type_="payout_requested",
        title=f"Счёт на оплату: {deal_code}",
        body_text=f"Менеджер загрузил счёт на вознаграждение{f' ₽{int(amount):,}' if amount else ''}. Требует согласования.",
        role="director",
        deal_id=deal_id,
    )
    return {"payout_id": payout_id, "invoice_url": invoice_url, "ok": True}, None

def update_payout_request(cur, payout_id: int, body: dict):
    """Директор одобряет/отклоняет заявку на выплату (с комментарием)."""
    status  = body["status"]  # approved | rejected
    comment = body.get("reject_comment", "")

    cur.execute(f"""
        UPDATE {SCHEMA}.payout_requests
        SET status=%s, reviewed_at=now(),
            reject_comment=CASE WHEN %s != '' THEN %s ELSE reject_comment END
        WHERE id=%s
        RETURNING deal_id, manager_id
    """, (status, comment, comment, payout_id))
    row = cur.fetchone()
    if not row:
        return None, "Заявка не найдена"
    deal_id, manager_id = row

    cur.execute(f"SELECT code FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
    deal_code = (cur.fetchone() or [""])[0]
    notif_type = "payout_approved" if status == "approved" else "payout_rejected"
    if status == "approved":
        notif_text = "Ваш счёт согласован! Ожидайте поступления оплаты."
    else:
        notif_text = f"Счёт отклонён.{f' Причина: {comment}' if comment else ' Уточните детали у директора.'}"
    create_notification(cur,
        type_=notif_type,
        title=f"Счёт {'согласован' if status == 'approved' else 'отклонён'}: {deal_code}",
        body_text=notif_text,
        role="crm_manager",
        staff_id=manager_id,
        deal_id=deal_id,
    )
    return {"ok": True, "status": status}, None

# ─── CONTRACTORS ─────────────────────────────────────────────────────────────

CONTRACTOR_TYPES = {
    "client":         "Заказчик",
    "supplier":       "Поставщик",
    "contractor":     "Подрядчик",
    "subcontractor":  "Субподрядчик",
    "internal":       "Внутренний",
    "general":        "Общий",
}

def get_contractors(cur, ctype: str = None):
    """Список контрагентов, опционально фильтр по типу."""
    if ctype:
        cur.execute(f"""
            SELECT id, contractor_type, name, inn, phone, email, contact_person,
                   legal_address, bank_name, bank_account, notes, is_active, created_at
            FROM {SCHEMA}.contractors
            WHERE contractor_type = %s AND is_active = TRUE
            ORDER BY name
        """, (ctype,))
    else:
        cur.execute(f"""
            SELECT id, contractor_type, name, inn, phone, email, contact_person,
                   legal_address, bank_name, bank_account, notes, is_active, created_at
            FROM {SCHEMA}.contractors
            WHERE is_active = TRUE
            ORDER BY contractor_type, name
        """)
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    for r in rows:
        r["type_label"] = CONTRACTOR_TYPES.get(r["contractor_type"], r["contractor_type"])
    return rows

def create_contractor(cur, body: dict):
    """Создание нового контрагента."""
    ctype         = body.get("contractor_type", "client")
    name          = body["name"]
    inn           = body.get("inn", "")
    kpp           = body.get("kpp", "")
    legal_address = body.get("legal_address", "")
    actual_address= body.get("actual_address", "")
    phone         = body.get("phone", "")
    email         = body.get("email", "")
    contact       = body.get("contact_person", "")
    bank_name     = body.get("bank_name", "")
    bank_account  = body.get("bank_account", "")
    bik           = body.get("bik", "")
    corr_account  = body.get("corr_account", "")
    notes         = body.get("notes", "")
    cur.execute(f"""
        INSERT INTO {SCHEMA}.contractors
            (contractor_type, name, inn, kpp, legal_address, actual_address,
             phone, email, contact_person, bank_name, bank_account, bik, corr_account, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, name, contractor_type
    """, (ctype, name, inn, kpp, legal_address, actual_address,
          phone, email, contact, bank_name, bank_account, bik, corr_account, notes))
    row = cur.fetchone()
    return {"id": row[0], "name": row[1], "contractor_type": row[2]}

def update_contractor(cur, cid: int, body: dict):
    """Обновление контрагента."""
    sets, vals = [], []
    for field in ["contractor_type","name","inn","kpp","legal_address","actual_address",
                  "phone","email","contact_person","bank_name","bank_account","bik","corr_account","notes"]:
        if field in body:
            sets.append(f"{field}=%s"); vals.append(body[field])
    if not sets:
        return False
    sets.append("updated_at=now()")
    vals.append(cid)
    cur.execute(f"UPDATE {SCHEMA}.contractors SET {', '.join(sets)} WHERE id=%s", vals)
    return True

# ─── DOCUMENTS ────────────────────────────────────────────────────────────────

# Метки типов документов по категориям
DOC_TYPE_LABELS = {
    # Сделки
    "deal_kp":             "КП",
    "deal_contract":       "Договор подряда",
    "deal_act":            "Акт приёмки",
    "deal_supplement":     "Доп. соглашение",
    # Поставщики
    "supply_contract":     "Договор поставки",
    "supply_invoice":      "Счёт",
    "supply_upd":          "УПД",
    "supply_waybill":      "Товарная накладная",
    "supply_certificate":  "Сертификат",
    # Подрядчики / субподрядчики
    "contractor_contract": "Договор подряда",
    "ks2":                 "Акт КС-2",
    "ks3":                 "Справка КС-3",
    "contractor_invoice":  "Счёт подрядчика",
    "contractor_estimate": "Смета подрядчика",
    # Внутренние
    "internal_regulation": "Регламент",
    "internal_order":      "Приказ",
    "internal_hr":         "Должностная инструкция",
    # Общие/компания
    "company_license":     "Лицензия",
    "company_certificate": "Сертификат компании",
    "company_permit":      "Разрешение",
}

def get_documents(cur, category: str = None, deal_id: int = None,
                  contractor_id: int = None, project_id: int = None):
    """Получить документы с фильтрами."""
    wheres, vals = ["1=1"], []
    if category:
        wheres.append("d.category=%s"); vals.append(category)
    if deal_id:
        wheres.append("d.deal_id=%s"); vals.append(deal_id)
    if contractor_id:
        wheres.append("d.contractor_id=%s"); vals.append(contractor_id)
    if project_id:
        wheres.append("d.project_id=%s"); vals.append(project_id)

    cur.execute(f"""
        SELECT d.id, d.doc_type, d.category, d.title, d.status, d.amount,
               d.doc_date, d.deal_id, d.project_id, d.contractor_id,
               d.file_url, d.file_name, d.file_size_kb, d.notes, d.created_at,
               deal.code  AS deal_code,
               proj.code  AS project_code,
               cont.name  AS contractor_name,
               cont.contractor_type
        FROM {SCHEMA}.documents d
        LEFT JOIN {SCHEMA}.deals     deal ON deal.id = d.deal_id
        LEFT JOIN {SCHEMA}.projects  proj ON proj.id = d.project_id
        LEFT JOIN {SCHEMA}.contractors cont ON cont.id = d.contractor_id
        WHERE {' AND '.join(wheres)}
        ORDER BY d.created_at DESC
        LIMIT 200
    """, vals)
    cols = [x[0] for x in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    for r in rows:
        r["doc_type_label"] = DOC_TYPE_LABELS.get(r["doc_type"], r["doc_type"])
    return rows

def create_document(cur, body: dict):
    """Создание документа вручную."""
    doc_type    = body["doc_type"]
    title       = body["title"]
    category    = body.get("category", _infer_category(doc_type))
    status      = body.get("status", "draft")
    amount      = body.get("amount")
    doc_date    = body.get("doc_date")
    deal_id     = body.get("deal_id")
    project_id  = body.get("project_id")
    contractor_id = body.get("contractor_id")
    file_url    = body.get("file_url")
    file_name   = body.get("file_name")
    file_size   = body.get("file_size_kb")
    notes       = body.get("notes", "")
    created_by  = body.get("created_by")

    cur.execute(f"""
        INSERT INTO {SCHEMA}.documents
            (doc_type, category, title, status, amount, doc_date,
             deal_id, project_id, contractor_id,
             file_url, file_name, file_size_kb, notes, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, title, doc_type, category
    """, (doc_type, category, title, status,
          float(amount) if amount else None,
          doc_date, deal_id, project_id, contractor_id,
          file_url, file_name, file_size, notes, created_by))
    row = cur.fetchone()
    return {"id": row[0], "title": row[1], "doc_type": row[2], "category": row[3]}

def update_document_status(cur, doc_id: int, status: str, file_url: str = None, file_name: str = None):
    cur.execute(f"""
        UPDATE {SCHEMA}.documents
        SET status=%s,
            file_url=COALESCE(%s, file_url),
            file_name=COALESCE(%s, file_name),
            updated_at=now()
        WHERE id=%s
        RETURNING id, status
    """, (status, file_url, file_name, doc_id))
    row = cur.fetchone()
    return {"id": row[0], "status": row[1]} if row else None

def auto_create_deal_documents(cur, deal_id: int, stage: str, deal_data: dict):
    """
    Автоматически создаёт документы при переходе сделки на стадию.
    stage='kp'       → создаёт КП
    stage='contract' → создаёт Договор подряда
    """
    # Не создаём дубли
    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.documents
        WHERE deal_id=%s AND doc_type=%s
    """, (deal_id, "deal_kp" if stage == "kp" else "deal_contract"))
    if cur.fetchone()[0] > 0:
        return

    client_name = deal_data.get("client_name", "")
    deal_code   = deal_data.get("code", "")
    budget      = deal_data.get("budget")
    contractor_id = deal_data.get("contractor_id")

    if stage == "kp":
        cur.execute(f"""
            INSERT INTO {SCHEMA}.documents
                (doc_type, category, title, status, amount, deal_id, contractor_id)
            VALUES ('deal_kp', 'deal', %s, 'draft', %s, %s, %s)
        """, (f"КП — {client_name} ({deal_code})",
              float(budget) if budget else None,
              deal_id, contractor_id))

    elif stage == "contract":
        cur.execute(f"""
            INSERT INTO {SCHEMA}.documents
                (doc_type, category, title, status, amount, deal_id, contractor_id,
                 doc_date)
            VALUES ('deal_contract', 'deal', %s, 'signed', %s, %s, %s, CURRENT_DATE)
        """, (f"Договор подряда — {client_name} ({deal_code})",
              float(budget) if budget else None,
              deal_id, contractor_id))

def _infer_category(doc_type: str) -> str:
    if doc_type.startswith("deal_"):       return "deal"
    if doc_type.startswith("supply_"):     return "supply"
    if doc_type.startswith("contractor_") or doc_type in ("ks2","ks3"): return "contractor"
    if doc_type.startswith("internal_"):   return "internal"
    if doc_type.startswith("company_"):    return "general"
    return "general"

# ─── CLIENTS / STAFF ─────────────────────────────────────────────────────────

def get_clients(cur):
    cur.execute(f"SELECT id, name, phone, email, source FROM {SCHEMA}.clients ORDER BY name")
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

def get_staff(cur, role_filter=None):
    if role_filter:
        cur.execute(f"SELECT id, name, role FROM {SCHEMA}.staff WHERE role=%s ORDER BY name", (role_filter,))
    else:
        cur.execute(f"SELECT id, name, role FROM {SCHEMA}.staff ORDER BY name")
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

# ─── EMPLOYEES ───────────────────────────────────────────────────────────────

def get_employees(cur):
    cur.execute(f"SELECT id, name, role FROM {SCHEMA}.staff ORDER BY role, name")
    cols = [desc[0] for desc in cur.description]
    employees = [dict(zip(cols, r)) for r in cur.fetchall()]

    ROLE_DEPT = {
        "crm_manager": "Продажи", "realtor": "Продажи",
        "foreman": "Строительство", "quality": "Качество",
        "mechanic": "Техника", "supplier": "Снабжение",
        "accountant": "Финансы", "director": "Руководство",
        "commercial": "Руководство", "construction_director": "Строительство",
        "supply_director": "Снабжение", "finance_director": "Финансы",
        "project_manager": "Строительство",
    }

    for emp in employees:
        emp["dept"] = ROLE_DEPT.get(emp["role"], "Прочее")
        # Сделки сотрудника (для менеджеров/риэлторов)
        if emp["role"] in ("crm_manager", "realtor"):
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.deals WHERE manager_id=%s OR realtor_id=%s", (emp["id"], emp["id"]))
            emp["deals_count"] = int(cur.fetchone()[0])
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.deals WHERE (manager_id=%s OR realtor_id=%s) AND stage='contract'", (emp["id"], emp["id"]))
            contracts = int(cur.fetchone()[0])
            emp["contracts_count"] = contracts
            total = emp["deals_count"] or 1
            emp["kpi"] = min(round((contracts / total) * 100 + 50), 99)
        elif emp["role"] == "foreman":
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.projects WHERE brigade ILIKE %s AND status='active'", (f"%{emp['name'].split()[0]}%",))
            emp["active_projects"] = int(cur.fetchone()[0])
            emp["kpi"] = 85
            emp["deals_count"] = None
        else:
            emp["deals_count"] = None
            emp["kpi"] = 80

    return employees

def create_employee(cur, body):
    name = body["name"]
    role = body["role"]
    cur.execute(f"INSERT INTO {SCHEMA}.staff (name, role) VALUES (%s, %s) RETURNING id, name, role", (name, role))
    row = cur.fetchone()
    return {"id": row[0], "name": row[1], "role": row[2]}

# ─── REPORTS ─────────────────────────────────────────────────────────────────

def get_reports(cur):
    # --- Менеджеры CRM ---
    cur.execute(f"""
        SELECT s.id, s.name, s.role,
               COUNT(d.id) AS leads,
               COUNT(CASE WHEN d.stage='contract' THEN 1 END) AS contracts,
               COALESCE(SUM(CASE WHEN d.stage='contract' THEN d.budget ELSE 0 END),0) AS revenue
        FROM {SCHEMA}.staff s
        LEFT JOIN {SCHEMA}.deals d ON d.manager_id = s.id OR d.realtor_id = s.id
        WHERE s.role IN ('crm_manager','realtor')
        GROUP BY s.id, s.name, s.role
        ORDER BY contracts DESC, revenue DESC
    """)
    cols = [desc[0] for desc in cur.description]
    managers = []
    for r in cur.fetchall():
        row = dict(zip(cols, r))
        total = row["leads"] or 1
        row["conversion"] = round(row["contracts"] / total * 100, 1)
        row["kpi"] = min(round(row["conversion"] + 50), 99)
        managers.append(row)

    # --- Бригады (прорабы) ---
    cur.execute(f"""
        SELECT s.id, s.name,
               COUNT(p.id) AS total_projects,
               COUNT(CASE WHEN p.status='done' THEN 1 END) AS done_projects,
               COALESCE(AVG(CASE WHEN p.status='done'
                   THEN EXTRACT(DAY FROM (p.updated_at - p.created_at)) END), 0) AS avg_days
        FROM {SCHEMA}.staff s
        LEFT JOIN {SCHEMA}.projects p ON p.brigade ILIKE '%' || split_part(s.name,' ',1) || '%'
        WHERE s.role = 'foreman'
        GROUP BY s.id, s.name
        ORDER BY done_projects DESC
    """)
    cols = [desc[0] for desc in cur.description]
    brigades = [dict(zip(cols, r)) for r in cur.fetchall()]
    for b in brigades:
        b["avg_days"] = round(float(b["avg_days"]), 1) if b["avg_days"] else 0
        on_time = b["done_projects"]
        total = b["total_projects"] or 1
        b["rating"] = round(3.5 + (on_time / total) * 1.4, 1)

    # --- KPI метрики ---
    cur.execute(f"""
        SELECT
            COUNT(*) FILTER (WHERE stage NOT IN ('lost','done')) AS active_deals,
            COUNT(*) FILTER (WHERE stage='contract') AS contracts,
            COUNT(*) AS total_deals
        FROM {SCHEMA}.deals
    """)
    d = cur.fetchone()
    active_deals, contracts, total_deals = d
    conversion = round(contracts / total_deals * 100, 1) if total_deals > 0 else 0

    cur.execute(f"""
        SELECT COUNT(*) FILTER (WHERE status='active') AS active,
               COUNT(*) FILTER (WHERE status='done')   AS done,
               COALESCE(AVG(CASE WHEN status='done'
                   THEN EXTRACT(DAY FROM (updated_at - created_at)) END),0) AS avg_dur
        FROM {SCHEMA}.projects
    """)
    p = cur.fetchone()
    active_proj, done_proj, avg_dur = p
    avg_dur = round(float(avg_dur), 1) if avg_dur else 62.0

    cur.execute(f"""
        SELECT
            COALESCE(SUM(CASE WHEN type='income'  THEN amount END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
        FROM {SCHEMA}.payments
        WHERE EXTRACT(YEAR FROM payment_date)  = EXTRACT(YEAR  FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    """)
    fin = cur.fetchone()
    income, expense = float(fin[0]), float(fin[1])
    margin = round((income - expense) / income * 100, 1) if income > 0 else 0

    kpis = [
        {"name": "Конверсия лид → договор",  "value": f"{conversion}%",  "target": "15%",  "status": "success" if conversion >= 15 else "warning" if conversion >= 8 else "error",  "trend": f"{total_deals} сделок всего"},
        {"name": "Средний срок сдачи дома",  "value": f"{avg_dur} дн.",  "target": "62 дн.", "status": "success" if avg_dur <= 62 else "warning" if avg_dur <= 68 else "error",  "trend": f"{done_proj} домов сдано"},
        {"name": "Маржинальность (месяц)",   "value": f"{margin}%",      "target": "35%",  "status": "success" if margin >= 35 else "warning" if margin >= 20 else "error",  "trend": f"₽{income:,.0f} доходов"},
        {"name": "Загрузка (активных домов)","value": str(active_proj),  "target": "4+",   "status": "success" if active_proj >= 4 else "warning", "trend": f"план 4 дома/мес"},
    ]

    # --- Поставщики (заявки) ---
    cur.execute(f"""
        SELECT status, COUNT(*) AS cnt,
               SUM(quantity) AS total_qty
        FROM {SCHEMA}.material_requests
        GROUP BY status
    """)
    req_stats = {r[0]: {"count": int(r[1]), "qty": float(r[2] or 0)} for r in cur.fetchall()}

    return {
        "managers": managers,
        "brigades": brigades,
        "kpis": kpis,
        "req_stats": req_stats,
        "summary": {
            "active_deals": int(active_deals),
            "contracts": int(contracts),
            "conversion": conversion,
            "active_projects": int(active_proj),
            "avg_duration": avg_dur,
            "income": income,
            "expense": expense,
            "margin": margin,
        }
    }

# ─── HANDLER ─────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Единый ERP API: deals, projects, procurement, payments, kcompany, dashboard, clients, staff"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    qs = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # Определяем роут: сначала из querystring ?r=, затем из path
    ROUTES = {"deals", "projects", "procurement", "payments", "kcompany", "dashboard", "clients", "staff",
              "employees", "reports", "slots", "serial_projects", "configurations", "individual_requests",
              "stage_durations", "estimate_works", "estimate_materials", "estimate",
              "contractors", "documents", "doc_templates", "contract_docs",
              "notifications", "payout_requests"}
    resource = qs.get("r", "")
    if not resource:
        parts = [p for p in path.split("/") if p]
        resource = next((p for p in parts if p in ROUTES), "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── DEALS ──────────────────────────────────────────────────────────────
        if resource == "deals":
            if method == "GET":
                data = get_deals(cur, archived=qs.get("archived") == "1")
                return ok(data)
            elif method == "POST":
                action = body.get("action", "create")
                if action in ("update_stage", "kp", "contract", "lost", "planning"):
                    deal_id = int(body["deal_id"])
                    stage = body.get("stage") or action
                    result, error = update_deal_stage(cur, deal_id, stage, body)
                    if error:
                        return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "save_kp_slot":
                    deal_id = int(body["deal_id"])
                    result, error = save_kp_slot(cur, deal_id, body)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "confirm_kp_contract":
                    deal_id = int(body["deal_id"])
                    result, error = confirm_kp_contract(cur, deal_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "confirm_kp_payment":
                    deal_id = int(body["deal_id"])
                    result, error = confirm_kp_payment(cur, deal_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "to_planning":
                    deal_id = int(body["deal_id"])
                    result, error = move_to_planning(cur, deal_id, body)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "archive":
                    deal_id = int(body["deal_id"])
                    # Читаем слоты сделки
                    cur.execute(f"SELECT slot_id, kp_slot_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
                    drow = cur.fetchone()
                    if not drow:
                        return err("Сделка не найдена")
                    slot_id_val, kp_slot_id_val = drow
                    # Освобождаем слоты (booked или busy → free)
                    for sid in set(filter(None, [slot_id_val, kp_slot_id_val])):
                        cur.execute(f"""
                            UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL
                            WHERE id=%s AND status IN ('booked','busy')
                        """, (sid,))
                    # Архивируем связанный проект если есть
                    cur.execute(f"""
                        UPDATE {SCHEMA}.projects SET status='archived', updated_at=now()
                        WHERE deal_id=%s AND status NOT IN ('archived','completed')
                    """, (deal_id,))
                    # Архивируем сделку
                    cur.execute(f"UPDATE {SCHEMA}.deals SET is_archived=TRUE, slot_id=NULL, updated_at=now() WHERE id=%s RETURNING code", (deal_id,))
                    row = cur.fetchone()
                    if not row:
                        return err("Сделка не найдена")
                    conn.commit()
                    return ok({"success": True, "code": row[0], "slots_freed": list(filter(None, [slot_id_val, kp_slot_id_val]))})
                elif action == "restore":
                    deal_id = int(body["deal_id"])
                    cur.execute(f"UPDATE {SCHEMA}.deals SET is_archived=FALSE, updated_at=now() WHERE id=%s RETURNING code", (deal_id,))
                    row = cur.fetchone()
                    if not row:
                        return err("Сделка не найдена")
                    conn.commit()
                    return ok({"success": True, "code": row[0]})
                elif action == "delete":
                    deal_id = int(body["deal_id"])
                    # Читаем слоты привязанные к этой сделке (slot_id и kp_slot_id)
                    cur.execute(f"SELECT slot_id, kp_slot_id FROM {SCHEMA}.deals WHERE id=%s", (deal_id,))
                    drow = cur.fetchone()
                    if not drow:
                        return err("Сделка не найдена")
                    slot_id_val, kp_slot_id_val = drow
                    # Освобождаем слоты
                    for sid in set(filter(None, [slot_id_val, kp_slot_id_val])):
                        cur.execute(f"""
                            UPDATE {SCHEMA}.slots SET status='free', deal_id=NULL
                            WHERE id=%s AND status IN ('booked','busy','free')
                        """, (sid,))
                    # Архивируем связанный проект если есть
                    cur.execute(f"""
                        UPDATE {SCHEMA}.projects SET status='archived', updated_at=now()
                        WHERE deal_id=%s AND status != 'archived'
                    """, (deal_id,))
                    # Удаляем сделку
                    cur.execute(f"DELETE FROM {SCHEMA}.deals WHERE id=%s RETURNING code", (deal_id,))
                    row = cur.fetchone()
                    if not row:
                        return err("Сделка не найдена")
                    conn.commit()
                    return ok({"success": True, "code": row[0]})
                else:
                    result, error = create_deal(cur, body)
                    if error:
                        return err(error)
                    conn.commit()
                    return ok(result, 201)

        # ── PROJECTS ───────────────────────────────────────────────────────────
        elif resource == "projects":
            if method == "GET":
                data = get_projects(cur, archived=qs.get("archived") == "1")
                return ok(data)
            elif method == "PUT":
                action = body.get("action")
                if action == "update_project":
                    pid    = int(body["project_id"])
                    fields = {}
                    if "status"  in body: fields["status"]  = body["status"]
                    if "brigade" in body: fields["brigade"] = body["brigade"]
                    if "address" in body: fields["address"] = body["address"]
                    if fields:
                        set_clause = ", ".join(f"{k}=%s" for k in fields)
                        cur.execute(f"UPDATE {SCHEMA}.projects SET {set_clause}, updated_at=now() WHERE id=%s",
                                    list(fields.values()) + [pid])
                        conn.commit()
                    return ok({"success": True})
                elif action == "approve_project":
                    pid = int(body["project_id"])
                    result, error = approve_project(cur, pid)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "cancel_project":
                    pid = int(body["project_id"])
                    result, error = cancel_project(cur, pid)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "complete_project":
                    pid = int(body["project_id"])
                    result, error = complete_project(cur, pid)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)

        # ── PROCUREMENT ────────────────────────────────────────────────────────
        elif resource == "procurement":
            if method == "GET":
                data = get_procurement(cur)
                return ok(data)
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update_status":
                    req_id     = int(body["id"])
                    new_status = body["status"]
                    ok_res = update_request_status(cur, req_id, new_status)
                    # Уведомление прорабу при статусе "закуплено"
                    if ok_res and new_status in ("purchased", "delivered"):
                        cur.execute(f"""
                            SELECT mr.code, mr.material, mr.foreman_id, p.code as project_code
                            FROM {SCHEMA}.material_requests mr
                            LEFT JOIN {SCHEMA}.projects p ON p.id = mr.project_id
                            WHERE mr.id = %s
                        """, (req_id,))
                        mr_row = cur.fetchone()
                        if mr_row:
                            mr_code, material, foreman_id, project_code = mr_row
                            create_notification(cur,
                                type_="material_purchased",
                                title=f"Материал закуплен: {material}",
                                body_text=f"Заявка {mr_code} по проекту {project_code or '—'} переведена в статус «Закуплено».",
                                role="foreman",
                                staff_id=foreman_id,
                            )
                    conn.commit()
                    return ok({"ok": ok_res})
                else:
                    result = create_material_request(cur, body)
                    # Уведомление снабженцу о новой заявке
                    cur.execute(f"""
                        SELECT mr.code, mr.material, p.code as project_code
                        FROM {SCHEMA}.material_requests mr
                        LEFT JOIN {SCHEMA}.projects p ON p.id = mr.project_id
                        WHERE mr.id = %s
                    """, (result["id"],))
                    mr_row = cur.fetchone()
                    if mr_row:
                        mr_code, material, project_code = mr_row
                        create_notification(cur,
                            type_="material_request_new",
                            title=f"Новая заявка на материалы по проекту {project_code or '—'}",
                            body_text=f"{material} · заявка {mr_code}. Перейдите в раздел Снабжение для обработки.",
                            role="supplier",
                        )
                    conn.commit()
                    return ok(result, 201)

        # ── PAYMENTS ───────────────────────────────────────────────────────────
        elif resource == "payments":
            if method == "GET":
                action = qs.get("action", "list")
                if action == "pl":
                    data = get_pl_summary(cur)
                else:
                    data = get_payments(cur)
                return ok(data)
            elif method == "POST":
                result = create_payment(cur, body)
                conn.commit()
                return ok(result, 201)

        # ── K_COMPANY ──────────────────────────────────────────────────────────
        elif resource == "kcompany":
            if method == "GET":
                action = qs.get("action", "last")
                if action == "calc":
                    data = calculate_kcompany(cur)
                    conn.commit()
                else:
                    data = get_kcompany_last(cur)
                    if not data:
                        data = calculate_kcompany(cur)
                        conn.commit()
                return ok(data)

        # ── DASHBOARD ──────────────────────────────────────────────────────────
        elif resource == "dashboard":
            data = get_dashboard(cur)
            return ok(data)

        # ── CLIENTS ────────────────────────────────────────────────────────────
        elif resource == "clients":
            return ok(get_clients(cur))

        # ── STAFF ──────────────────────────────────────────────────────────────
        elif resource == "staff":
            role_filter = qs.get("role")
            return ok(get_staff(cur, role_filter))

        # ── EMPLOYEES ──────────────────────────────────────────────────────────
        elif resource == "employees":
            if method == "GET":
                return ok(get_employees(cur))
            elif method == "POST":
                result = create_employee(cur, body)
                conn.commit()
                return ok(result, 201)

        # ── REPORTS ────────────────────────────────────────────────────────────
        elif resource == "reports":
            if method == "GET":
                return ok(get_reports(cur))

        # ── SLOTS ──────────────────────────────────────────────────────────────
        elif resource == "slots":
            if method == "GET":
                action = qs.get("action", "free")
                if action == "plan":
                    show_archived = qs.get("show_archived") == "1"
                    return ok(get_slot_plan(cur, show_archived))
                else:
                    # Передаём дату подписания для фильтрации: только слоты >= signed_date + 15д
                    signed_date = qs.get("signed_date")
                    return ok(get_free_slots(cur, signed_date))
            elif method == "POST":
                action = body.get("action", "update_limit")
                if action == "create_slots":
                    year  = int(body["year"])
                    month = int(body["month"])
                    count = int(body.get("count", 4))
                    limit = int(body.get("monthly_limit", 4))
                    result = create_slots(cur, year, month, count, limit)
                    conn.commit()
                    return ok(result)
                elif action == "delete_slot":
                    slot_id = int(body["slot_id"])
                    result, error = delete_slot(cur, slot_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                else:
                    # Обновить лимит месяца
                    result = update_slot_limit(cur, body["year"], body["month"], body["monthly_limit"])
                    conn.commit()
                    return ok(result)

        # ── SERIAL PROJECTS ────────────────────────────────────────────────────
        elif resource == "serial_projects":
            if method == "GET":
                return ok(get_serial_projects(cur))
            elif method == "POST":
                result = create_serial_project(cur, body)
                conn.commit()
                return ok(result, 201)

        # ── CONFIGURATIONS ─────────────────────────────────────────────────────
        elif resource == "configurations":
            if method == "GET":
                sp_id = qs.get("serial_project_id")
                if not sp_id:
                    return err("serial_project_id required")
                return ok(get_configurations(cur, int(sp_id)))
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update":
                    cfg_id = int(body["id"])
                    # Если устанавливаем скидку — уведомляем менеджеров
                    is_new_discount = float(body.get("discount_pct", 0)) > 0
                    result = update_configuration(cur, cfg_id, body)
                    if is_new_discount:
                        cur.execute(f"SELECT name FROM {SCHEMA}.configurations WHERE id=%s", (cfg_id,))
                        cfg_name = (cur.fetchone() or [""])[0]
                        pct = float(body.get("discount_pct", 0))
                        until = body.get("discount_until", "")
                        create_notification(cur,
                            type_="discount_set",
                            title=f"Новая скидка на «{cfg_name}»",
                            body_text=f"Директор установил скидку {pct:.0f}%{f' до {until}' if until else ''}. Предложите клиентам!",
                            role="crm_manager",
                            deal_id=None,
                        )
                    conn.commit()
                    return ok(result)
                else:
                    result = create_configuration(cur, body)
                    conn.commit()
                    return ok(result, 201)

        # ── INDIVIDUAL REQUESTS ────────────────────────────────────────────────
        elif resource == "individual_requests":
            if method == "GET":
                return ok(get_individual_requests(cur))
            elif method == "POST":
                req_id = int(body.get("id", 0))
                if req_id:
                    ok_res = update_individual_request(cur, req_id, body)
                    conn.commit()
                    return ok({"ok": ok_res})
                return err("id required")

        # ── STAGE DURATIONS (нормативы директора) ──────────────────────────────
        elif resource == "stage_durations":
            if method == "GET":
                return ok(get_stage_durations(cur))
            elif method == "POST":
                stage_num    = int(body["stage_num"])
                dur          = int(body["duration_days"])
                cur.execute(f"""
                    UPDATE {SCHEMA}.stage_durations
                    SET duration_days=%s, updated_at=now()
                    WHERE stage_num=%s
                    RETURNING stage_num, stage_name, duration_days
                """, (dur, stage_num))
                row = cur.fetchone()
                if not row:
                    return err("Этап не найден")
                # Норматив обновлён — применяется только к новым проектам (lead/kp).
                # Активные проекты (status active/planning) не затрагиваем.
                conn.commit()
                return ok({
                    "stage_num": row[0],
                    "stage_name": row[1],
                    "duration_days": row[2],
                })

        # ── ESTIMATE (полная смета: работы + материалы) ────────────────────────
        elif resource == "estimate":
            sp_id = qs.get("serial_project_id") or body.get("serial_project_id")
            if not sp_id:
                return err("serial_project_id required")
            return ok(get_estimate(cur, int(sp_id)))

        elif resource == "estimate_works":
            if method == "GET":
                sp_id = qs.get("serial_project_id")
                if not sp_id:
                    return err("serial_project_id required")
                est = get_estimate(cur, int(sp_id))
                return ok([w for s in est["stages"] for w in s["works"]])
            elif method == "POST":
                result = upsert_estimate_row(cur, "stage_works", body)
                conn.commit()
                return ok(result, 201)

        elif resource == "estimate_materials":
            if method == "GET":
                sp_id = qs.get("serial_project_id")
                if not sp_id:
                    return err("serial_project_id required")
                est = get_estimate(cur, int(sp_id))
                return ok([m for s in est["stages"] for m in s["materials"]])
            elif method == "POST":
                result = upsert_estimate_row(cur, "stage_materials", body)
                conn.commit()
                return ok(result, 201)

        # ── CONTRACTORS ────────────────────────────────────────────────────────
        elif resource == "contractors":
            if method == "GET":
                ctype = qs.get("type")
                return ok(get_contractors(cur, ctype))
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update":
                    cid = int(body["id"])
                    update_contractor(cur, cid, body)
                    conn.commit()
                    return ok({"id": cid, "ok": True})
                else:
                    result = create_contractor(cur, body)
                    conn.commit()
                    return ok(result, 201)

        # ── DOCUMENTS ──────────────────────────────────────────────────────────
        elif resource == "documents":
            if method == "GET":
                category    = qs.get("category")
                deal_id     = int(qs["deal_id"])    if qs.get("deal_id")     else None
                contractor_id = int(qs["contractor_id"]) if qs.get("contractor_id") else None
                project_id  = int(qs["project_id"]) if qs.get("project_id") else None
                return ok(get_documents(cur, category, deal_id, contractor_id, project_id))
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update_status":
                    doc_id = int(body["id"])
                    result = update_document_status(
                        cur, doc_id, body["status"],
                        body.get("file_url"), body.get("file_name")
                    )
                    conn.commit()
                    return ok(result)
                else:
                    result = create_document(cur, body)
                    conn.commit()
                    return ok(result, 201)

        # ── DOC TEMPLATES (директор управляет пакетом) ────────────────────────
        elif resource == "doc_templates":
            if method == "GET":
                active_only = qs.get("all") != "1"
                return ok(get_doc_templates(cur, active_only))
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update":
                    tpl_id = int(body["id"])
                    update_doc_template(cur, tpl_id, body)
                    conn.commit()
                    return ok({"id": tpl_id, "ok": True})
                else:
                    result = create_doc_template(cur, body)
                    conn.commit()
                    return ok(result, 201)

        # ── CONTRACT DOCUMENTS (пакет по сделке) ──────────────────────────────
        elif resource == "contract_docs":
            if method == "GET":
                deal_id = qs.get("deal_id")
                if not deal_id:
                    return err("deal_id required")
                # Возвращаем пакет + contract_status сделки
                pkg = get_contract_docs(cur, int(deal_id))
                cur.execute(f"SELECT contract_status FROM {SCHEMA}.deals WHERE id=%s", (int(deal_id),))
                cs_row = cur.fetchone()
                pkg["contract_status"] = cs_row[0] if cs_row else "none"
                return ok(pkg)
            elif method == "POST":
                action  = body.get("action", "upload")
                deal_id = int(body["deal_id"])

                if action == "upload":
                    template_id = int(body["template_id"])
                    result = upload_contract_doc(cur, deal_id, template_id, body)
                    conn.commit()
                    return ok(result)

                elif action == "submit_review":
                    # Менеджер отправляет на проверку директору
                    result, error = submit_docs_for_review(cur, deal_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)

                elif action == "approve":
                    # Директор подтверждает/отклоняет
                    approved = bool(body.get("approved", True))
                    reason   = body.get("reject_reason", "")
                    result, error = approve_docs(cur, deal_id, approved, reason)
                    if error: return err(error)
                    # Если подтвердил — сразу переводим в ожидание оплаты
                    if approved:
                        set_payment_pending(cur, deal_id)
                    conn.commit()
                    return ok(result)

                elif action == "confirm_payment":
                    # Директор подтверждает оплату
                    result, error = confirm_payment(cur, deal_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)

                elif action == "upload_signed":
                    # Директор загружает подписанный вариант документа
                    template_id = int(body["template_id"])
                    result, error = upload_signed_doc(cur, deal_id, template_id, body)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)

                elif action == "confirm_doc_payment":
                    # Директор нажимает «Оплата прошла» у документа
                    template_id = int(body["template_id"])
                    result, error = confirm_doc_payment(cur, deal_id, template_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)

        # ── PAYOUT REQUESTS ────────────────────────────────────────────────────
        elif resource == "payout_requests":
            if method == "GET":
                manager_id = int(qs["manager_id"]) if qs.get("manager_id") else None
                return ok({"deals": get_payout_deals(cur, manager_id)})
            elif method == "POST":
                action = body.get("action", "create")
                if action == "create":
                    deal_id_pr = int(body["deal_id"])
                    mgr_id     = int(body["manager_id"])
                    result, error = create_payout_request(cur, deal_id_pr, mgr_id, body)
                    if error: return err(error)
                    conn.commit()
                    return ok(result, 201)
                elif action == "update":
                    payout_id = int(body["payout_id"])
                    result, error = update_payout_request(cur, payout_id, body)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "resubmit":
                    # Менеджер повторно подаёт счёт после отклонения
                    payout_id = int(body["payout_id"])
                    file_b64  = body.get("invoice_file_b64")
                    file_name = body.get("invoice_file_name")
                    amount    = body.get("amount")
                    invoice_url = None
                    if file_b64 and file_name:
                        invoice_url, _ = upload_file_to_s3(file_b64, f"invoice_resubmit_{payout_id}_{file_name}", "payouts")
                    cur.execute(f"""
                        UPDATE {SCHEMA}.payout_requests
                        SET status='pending', invoice_file_url=COALESCE(%s, invoice_file_url),
                            invoice_file_name=COALESCE(%s, invoice_file_name),
                            amount=COALESCE(%s, amount), reject_comment=NULL
                        WHERE id=%s RETURNING deal_id
                    """, (invoice_url, file_name if file_b64 else None, amount, payout_id))
                    row = cur.fetchone()
                    if row:
                        cur.execute(f"SELECT code FROM {SCHEMA}.deals WHERE id=%s", (row[0],))
                        deal_code = (cur.fetchone() or [""])[0]
                        create_notification(cur, type_="payout_requested",
                            title=f"Новый счёт на оплату: {deal_code}",
                            body_text="Менеджер загрузил исправленный счёт.", role="director", deal_id=row[0])
                    conn.commit()
                    return ok({"ok": True})

        # ── NOTIFICATIONS ──────────────────────────────────────────────────────
        elif resource == "notifications":
            if method == "GET":
                role      = qs.get("role")
                staff_id  = int(qs["staff_id"]) if qs.get("staff_id") else None
                unread    = qs.get("unread") == "1"
                notifs    = get_notifications(cur, role, staff_id, unread)
                count     = get_unread_count(cur, role, staff_id)
                return ok({"notifications": notifs, "unread_count": count})
            elif method == "POST":
                action = body.get("action", "read")
                if action == "read":
                    ids = body.get("ids", [])
                    mark_notifications_read(cur, ids)
                    conn.commit()
                    return ok({"ok": True})

        # ── CLIENT PORTAL ──────────────────────────────────────────────────────
        elif resource == "client_portal":
            if method == "GET":
                token = qs.get("token", "")
                if not token:
                    return err("token обязателен", 400)
                data = get_client_portal(cur, token)
                if not data:
                    return err("Страница не найдена", 404)
                conn.commit()  # сохраняем авто-созданный акт если был
                return ok(data)
            elif method == "POST":
                action = body.get("action")
                if action == "sign_act":
                    act_id = int(body["act_id"])
                    result, error = sign_client_act(cur, act_id)
                    if error: return err(error)
                    conn.commit()
                    return ok(result)
                elif action == "get_token":
                    deal_id = int(body["deal_id"])
                    token = ensure_client_token(cur, deal_id)
                    conn.commit()
                    return ok({"client_token": token})
                elif action == "create_act":
                    project_id = int(body["project_id"])
                    stage_id   = int(body["stage_id"])
                    amount     = float(body.get("amount", 0))
                    title      = body.get("title", "")
                    act, error = create_client_act(cur, project_id, stage_id, amount, title)
                    if error: return err(error)
                    conn.commit()
                    return ok(act, 201)

        return err("Маршрут не найден", 404)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()