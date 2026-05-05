"""
ERP: Сделки (CRM) — создание, список, смена статуса, автосоздание проекта
"""
import json
import os
import psycopg2
from datetime import date, datetime, timedelta


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

STAGE_NAMES = {
    'Фундамент': 10,
    'Коробка': 8,
    'Кровля': 28,
    'Штукатурка': 4,
}


SCHEMA = 't_p60494808_erp_system_creation'

def get_conn():
    dsn = os.environ['DATABASE_URL']
    if '?' in dsn:
        dsn += f'&options=-csearch_path%3D{SCHEMA}'
    else:
        dsn += f'?options=-csearch_path%3D{SCHEMA}'
    return psycopg2.connect(dsn)


def json_serial(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def handler(event: dict, context) -> dict:
    """Управление сделками CRM"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET /erp-deals — список сделок
        if method == 'GET' and not path.endswith('/create-project'):
            cur.execute("""
                SELECT d.id, d.code, d.stage, d.source, d.budget, d.start_date,
                       d.notes, d.project_id, d.created_at, d.updated_at,
                       c.name as client_name, c.phone as client_phone,
                       sm.name as manager_name,
                       sr.name as realtor_name,
                       s.status as slot_status
                FROM deals d
                LEFT JOIN clients c ON d.client_id = c.id
                LEFT JOIN staff sm ON d.manager_id = sm.id
                LEFT JOIN staff sr ON d.realtor_id = sr.id
                LEFT JOIN slots s ON d.slot_id = s.id
                ORDER BY d.created_at DESC
                LIMIT 100
            """)
            cols = [desc[0] for desc in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

            # Clients for form
            cur.execute("SELECT id, name, phone FROM clients ORDER BY name")
            clients = [{'id': r[0], 'name': r[1], 'phone': r[2]} for r in cur.fetchall()]

            # Managers for form
            cur.execute("SELECT id, name, role FROM staff WHERE is_active = TRUE ORDER BY name")
            staff = [{'id': r[0], 'name': r[1], 'role': r[2]} for r in cur.fetchall()]

            # Free slots
            cur.execute("SELECT id, year, month FROM slots WHERE status = 'free' ORDER BY year, month LIMIT 10")
            slots = [{'id': r[0], 'year': r[1], 'month': r[2]} for r in cur.fetchall()]

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'deals': rows, 'clients': clients, 'staff': staff, 'slots': slots}, default=json_serial)
            }

        # POST /erp-deals — создать сделку
        if method == 'POST' and not path.endswith('/create-project'):
            body = json.loads(event.get('body') or '{}')

            client_id = body.get('client_id')
            manager_id = body.get('manager_id')
            realtor_id = body.get('realtor_id')
            source = body.get('source', '')
            budget = body.get('budget')
            start_date = body.get('start_date')
            notes = body.get('notes', '')

            if not client_id or not start_date:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'client_id и start_date обязательны'})}

            # Генерация кода
            cur.execute("SELECT COUNT(*) FROM deals")
            count = cur.fetchone()[0]
            code = f"ЛД-{count + 1:04d}"

            # Найти свободный слот
            cur.execute("SELECT id FROM slots WHERE status = 'free' ORDER BY year, month LIMIT 1")
            slot_row = cur.fetchone()
            if not slot_row:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет свободных слотов на производстве'})}
            slot_id = slot_row[0]

            cur.execute("""
                INSERT INTO deals (code, client_id, manager_id, realtor_id, source, budget, start_date, notes, slot_id, stage)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'new')
                RETURNING id, code
            """, (code, client_id, manager_id, realtor_id, source, budget, start_date, notes, slot_id))
            deal_id, deal_code = cur.fetchone()

            # Бронируем слот
            cur.execute("UPDATE slots SET status = 'booked', deal_id = %s WHERE id = %s", (deal_id, slot_id))

            conn.commit()
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'success': True, 'deal_id': deal_id, 'deal_code': deal_code})
            }

        # PUT /erp-deals — обновить статус (stage)
        if method == 'PUT':
            body = json.loads(event.get('body') or '{}')
            deal_id = body.get('deal_id')
            new_stage = body.get('stage')

            if not deal_id or not new_stage:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'deal_id и stage обязательны'})}

            cur.execute("UPDATE deals SET stage = %s, updated_at = NOW() WHERE id = %s RETURNING id, code, client_id, start_date, slot_id", (new_stage, deal_id))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Сделка не найдена'})}

            did, dcode, client_id, start_date, slot_id = row
            project_id = None

            # Если договор подписан — создать проект автоматически
            if new_stage == 'contract':
                # Генерация кода проекта
                cur.execute("SELECT COUNT(*) FROM projects")
                pcount = cur.fetchone()[0]
                pcode = f"ДОМ-{pcount + 1:03d}"

                deadline = (start_date + timedelta(days=62)) if start_date else date.today() + timedelta(days=62)

                cur.execute("""
                    INSERT INTO projects (code, deal_id, client_id, start_date, deadline, status)
                    VALUES (%s, %s, %s, %s, %s, 'active')
                    RETURNING id
                """, (pcode, did, client_id, start_date or date.today(), deadline))
                project_id = cur.fetchone()[0]

                # Обновить deal
                cur.execute("UPDATE deals SET project_id = %s WHERE id = %s", (project_id, did))

                # Слот → занят
                if slot_id:
                    cur.execute("UPDATE slots SET status = 'busy' WHERE id = %s", (slot_id,))

                # Развернуть этапы
                stage_list = [
                    ('Фундамент', 1, 10),
                    ('Коробка', 2, 8),
                    ('Кровля', 3, 28),
                    ('Штукатурка', 4, 4),
                ]
                current = start_date or date.today()
                for sname, sorder, sdays in stage_list:
                    send = current + timedelta(days=sdays)
                    cur.execute("""
                        INSERT INTO project_stages (project_id, name, order_num, duration_days, planned_start, planned_end, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (project_id, sname, sorder, sdays, current, send, 'pending' if sorder > 1 else 'active'))
                    current = send

            conn.commit()
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'success': True, 'project_id': project_id})
            }

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()