"""
ERP: Заявки на материалы — создание, список, смена статуса
"""
import json
import os
import psycopg2
from datetime import date, datetime


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    """Заявки на материалы (снабжение)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == 'GET':
            cur.execute("""
                SELECT mr.id, mr.code, mr.material, mr.quantity, mr.unit,
                       mr.required_date, mr.priority, mr.status, mr.notes, mr.created_at,
                       p.code as project_code,
                       c.name as client_name,
                       s.name as foreman_name
                FROM material_requests mr
                LEFT JOIN projects p ON mr.project_id = p.id
                LEFT JOIN clients c ON p.client_id = c.id
                LEFT JOIN staff s ON mr.foreman_id = s.id
                ORDER BY mr.created_at DESC
                LIMIT 100
            """)
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

            # Проекты для формы
            cur.execute("SELECT id, code FROM projects WHERE status = 'active' ORDER BY code")
            projects = [{'id': r[0], 'code': r[1]} for r in cur.fetchall()]

            # Прорабы для формы
            cur.execute("SELECT id, name FROM staff WHERE role = 'foreman' AND is_active = TRUE ORDER BY name")
            foremen = [{'id': r[0], 'name': r[1]} for r in cur.fetchall()]

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'requests': rows, 'projects': projects, 'foremen': foremen}, default=json_serial)
            }

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            project_id = body.get('project_id')
            material = body.get('material', '').strip()
            quantity = body.get('quantity')
            unit = body.get('unit', 'шт')
            required_date = body.get('required_date')
            priority = body.get('priority', 'normal')
            foreman_id = body.get('foreman_id')
            notes = body.get('notes', '')

            if not material:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Материал обязателен'})}

            cur.execute("SELECT COUNT(*) FROM material_requests")
            count = cur.fetchone()[0]
            code = f"ЗМ-{count + 1:04d}"

            cur.execute("""
                INSERT INTO material_requests (code, project_id, material, quantity, unit, required_date, priority, foreman_id, notes, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'new')
                RETURNING id, code
            """, (code, project_id, material, quantity, unit, required_date, priority, foreman_id, notes))
            req_id, req_code = cur.fetchone()
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'success': True, 'request_id': req_id, 'code': req_code})
            }

        if method == 'PUT':
            body = json.loads(event.get('body') or '{}')
            req_id = body.get('request_id')
            new_status = body.get('status')
            if not req_id or not new_status:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'request_id и status обязательны'})}
            cur.execute("UPDATE material_requests SET status = %s, updated_at = NOW() WHERE id = %s", (new_status, req_id))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()