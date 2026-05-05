"""
ERP API — универсальный endpoint для всех операций системы.
Роуты: /deals, /projects, /procurement, /payments, /kcompany, /dashboard, /clients, /staff, /employees, /reports
"""
import json
import os
import psycopg2
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
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.{table}")
    n = cur.fetchone()[0] + 1
    return f"{prefix}-{n:04d}"

# ─── DEALS ───────────────────────────────────────────────────────────────────

def get_free_slots(cur):
    """Возвращает свободные слоты с загрузкой месяца для слот-плана."""
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
          AND s.start_date >= CURRENT_DATE
        GROUP BY s.id, s.year, s.month, s.start_date, s.status, s.monthly_limit
        ORDER BY s.start_date
    """)
    cols = [desc[0] for desc in cur.description]
    slots = []
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        d["available"] = int(d["monthly_limit"]) - int(d["occupied_count"]) > 0
        d["occupied_count"] = int(d["occupied_count"])
        slots.append(d)
    return slots

def get_slot_plan(cur):
    """Полная картина слот-плана по месяцам (для директора/коммерческого)."""
    cur.execute(f"""
        SELECT
            s.year, s.month, s.monthly_limit,
            COUNT(*) FILTER (WHERE s.status = 'free')   AS free_count,
            COUNT(*) FILTER (WHERE s.status = 'booked') AS booked_count,
            COUNT(*) FILTER (WHERE s.status = 'busy')   AS busy_count
        FROM {SCHEMA}.slots s
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
    return months

def get_deals(cur):
    cur.execute(f"""
        SELECT d.id, d.code, d.stage, d.budget, d.start_date, d.source, d.notes, d.created_at,
               c.name as client_name, c.phone as client_phone,
               sm.name as manager_name, sr.name as realtor_name,
               sl.id as slot_id, sl.year as slot_year, sl.month as slot_month,
               sl.start_date as slot_start_date,
               d.project_id, d.project_type,
               sp.name as serial_project_name,
               cfg.name as configuration_name,
               cfg.duration_days as configuration_duration,
               cfg.price_coefficient,
               d.selected_stages, d.signed_date, d.buffer_days,
               d.kp_notes, d.address, d.planned_start_date,
               d.serial_project_id, d.configuration_id
        FROM {SCHEMA}.deals d
        LEFT JOIN {SCHEMA}.clients c ON c.id = d.client_id
        LEFT JOIN {SCHEMA}.staff sm ON sm.id = d.manager_id
        LEFT JOIN {SCHEMA}.staff sr ON sr.id = d.realtor_id
        LEFT JOIN {SCHEMA}.slots sl ON sl.id = d.slot_id
        LEFT JOIN {SCHEMA}.serial_projects sp ON sp.id = d.serial_project_id
        LEFT JOIN {SCHEMA}.configurations cfg ON cfg.id = d.configuration_id
        ORDER BY d.created_at DESC
        LIMIT 100
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def get_stage_durations(cur):
    """Загружает нормативы этапов из БД (единый источник правды)."""
    cur.execute(f"""
        SELECT stage_num, stage_name, duration_days, parallel_group, depends_on
        FROM {SCHEMA}.stage_durations ORDER BY sort_order
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

    cur.execute(f"UPDATE {SCHEMA}.deals SET {', '.join(sets)} WHERE id=%s RETURNING id, stage", vals)
    row = cur.fetchone()
    if not row:
        return None, "Сделка не найдена"
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

    # Обрабатываем слот (только для серийных)
    actual_start = planned_start
    if project_type == 'serial' and slot_id:
        slot_id = int(slot_id)
        cur.execute(f"SELECT id, year, month, start_date, status, monthly_limit FROM {SCHEMA}.slots WHERE id=%s", (slot_id,))
        slot_row = cur.fetchone()
        if not slot_row:
            return None, "Слот не найден"
        s_id, s_year, s_month, s_start_date, s_status, s_limit = slot_row
        if s_status != 'free':
            return None, "Выбранный слот уже занят"
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.slots WHERE year=%s AND month=%s AND status IN ('booked','busy')", (s_year, s_month))
        if int(cur.fetchone()[0]) + 1 > s_limit:
            return None, f"Месяц перегружен. Выберите другой"
        # start_date = дата слота + буфер на подписание
        slot_start = s_start_date if isinstance(s_start_date, date) else date.fromisoformat(str(s_start_date))
        actual_start = (slot_start + timedelta(days=buf_days)).isoformat()
        sets.append("slot_id=%s"); vals.append(slot_id)
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='booked', deal_id=%s WHERE id=%s", (deal_id, slot_id))

    if actual_start:
        sets.append("planned_start_date=%s"); vals.append(actual_start)
    if address:
        sets.append("address=%s"); vals.append(address)
    if budget:
        sets.append("budget=%s"); vals.append(float(budget))
    sets.append("signed_date=%s");   vals.append(signed_date)
    sets.append("stage='contract'")
    sets.append("updated_at=now()")
    vals.append(deal_id)

    cur.execute(f"UPDATE {SCHEMA}.deals SET {', '.join(sets)} WHERE id=%s", vals)

    # Автосоздание проекта
    start_for_project = actual_start or date.today().isoformat()
    project_id, perr = create_project_from_deal(cur, deal_id, client_id, start_for_project, slot_id)
    if perr:
        return None, perr

    return {"id": deal_id, "stage": "contract", "project_id": project_id}, None

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
        INSERT INTO {SCHEMA}.projects (code, deal_id, client_id, start_date, deadline, status, address)
        VALUES (%s, %s, %s, %s, %s, 'active', %s)
        RETURNING id
    """, (code, deal_id, client_id, start_date, deadline, address or ""))
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

    # Слот → занят
    if slot_id:
        cur.execute(f"UPDATE {SCHEMA}.slots SET status='busy' WHERE id=%s", (slot_id,))

    # Привязать project_id к сделке + перевести в planning
    cur.execute(f"""
        UPDATE {SCHEMA}.deals SET project_id=%s, stage='planning', updated_at=now()
        WHERE id=%s
    """, (project_id, deal_id))

    return project_id, None

def get_projects(cur):
    cur.execute(f"""
        SELECT p.id, p.code, p.start_date, p.deadline, p.status, p.brigade, p.total_cost,
               c.name as client_name, c.phone as client_phone,
               p.address,
               (SELECT COUNT(*) FROM {SCHEMA}.project_stages ps WHERE ps.project_id=p.id) as total_stages,
               (SELECT COUNT(*) FROM {SCHEMA}.project_stages ps WHERE ps.project_id=p.id AND ps.status='done') as done_stages
        FROM {SCHEMA}.projects p
        LEFT JOIN {SCHEMA}.clients c ON c.id = p.client_id
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
    for p in projects:
        cur.execute(f"""
            SELECT id, name, description, price_coefficient, duration_days, included_stages
            FROM {SCHEMA}.configurations
            WHERE serial_project_id=%s AND is_active=TRUE
            ORDER BY duration_days
        """, (p["id"],))
        ccols = [desc[0] for desc in cur.description]
        p["configurations"] = [dict(zip(ccols, r)) for r in cur.fetchall()]
    return projects

def get_configurations(cur, serial_project_id):
    cur.execute(f"""
        SELECT id, name, description, price_coefficient, duration_days, included_stages
        FROM {SCHEMA}.configurations
        WHERE serial_project_id=%s AND is_active=TRUE
        ORDER BY duration_days
    """, (serial_project_id,))
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

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
              "stage_durations"}
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
                data = get_deals(cur)
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
                else:
                    result, error = create_deal(cur, body)
                    if error:
                        return err(error)
                    conn.commit()
                    return ok(result, 201)

        # ── PROJECTS ───────────────────────────────────────────────────────────
        elif resource == "projects":
            if method == "GET":
                data = get_projects(cur)
                return ok(data)

        # ── PROCUREMENT ────────────────────────────────────────────────────────
        elif resource == "procurement":
            if method == "GET":
                data = get_procurement(cur)
                return ok(data)
            elif method == "POST":
                action = body.get("action", "create")
                if action == "update_status":
                    ok_res = update_request_status(cur, int(body["id"]), body["status"])
                    conn.commit()
                    return ok({"ok": ok_res})
                else:
                    result = create_material_request(cur, body)
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
                    return ok(get_slot_plan(cur))
                else:
                    return ok(get_free_slots(cur))
            elif method == "POST":
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
                # Директор меняет длительность этапа
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
                conn.commit()
                return ok({"stage_num": row[0], "stage_name": row[1], "duration_days": row[2]})

        return err("Маршрут не найден", 404)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()