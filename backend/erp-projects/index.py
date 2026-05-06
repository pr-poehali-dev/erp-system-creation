"""
ERP: Проекты строительства — список, детали, этапы, статус этапа
"""
import json
import os
import psycopg2
from datetime import date, datetime
from decimal import Decimal


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
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def handler(event: dict, context) -> dict:
    """Проекты строительства и этапы"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == 'GET':
            project_id = params.get('id')

            if project_id:
                # Детали одного проекта
                cur.execute("""
                    SELECT p.*, c.name as client_name, c.phone as client_phone
                    FROM projects p
                    LEFT JOIN clients c ON p.client_id = c.id
                    WHERE p.id = %s
                """, (project_id,))
                cols = [d[0] for d in cur.description]
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Проект не найден'})}
                project = dict(zip(cols, row))

                cur.execute("""
                    SELECT * FROM project_stages WHERE project_id = %s ORDER BY order_num
                """, (project_id,))
                scols = [d[0] for d in cur.description]
                stages = [dict(zip(scols, r)) for r in cur.fetchall()]

                return {
                    'statusCode': 200,
                    'headers': CORS,
                    'body': json.dumps({'project': project, 'stages': stages}, default=json_serial)
                }

            else:
                # Список проектов (archived=1 — только архив, иначе — активные/завершённые)
                show_archived = params.get('archived') == '1'
                where_clause = "WHERE p.status = 'archived'" if show_archived else "WHERE p.status != 'archived'"
                cur.execute(f"""
                    SELECT p.id, p.code, p.address, p.brigade, p.start_date, p.deadline, p.status, p.total_cost,
                           c.name as client_name,
                           (SELECT COUNT(*) FROM project_stages ps WHERE ps.project_id = p.id) as total_stages,
                           (SELECT COUNT(*) FROM project_stages ps WHERE ps.project_id = p.id AND ps.status = 'done') as done_stages,
                           (SELECT ps.name FROM project_stages ps WHERE ps.project_id = p.id AND ps.status = 'active' LIMIT 1) as current_stage
                    FROM projects p
                    LEFT JOIN clients c ON p.client_id = c.id
                    {where_clause}
                    ORDER BY p.updated_at DESC
                """)
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return {
                    'statusCode': 200,
                    'headers': CORS,
                    'body': json.dumps({'projects': rows}, default=json_serial)
                }

        if method == 'PUT':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action')

            if action == 'update_stage':
                stage_id = body.get('stage_id')
                new_status = body.get('status')
                cur.execute("UPDATE project_stages SET status = %s WHERE id = %s RETURNING project_id", (new_status, stage_id))
                row = cur.fetchone()
                if row and new_status == 'done':
                    # Активировать следующий этап
                    cur.execute("""
                        UPDATE project_stages SET status = 'active'
                        WHERE project_id = %s AND status = 'pending'
                        AND order_num = (
                            SELECT order_num + 1 FROM project_stages WHERE id = %s
                        )
                    """, (row[0], stage_id))
                conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

            if action == 'update_project':
                pid = body.get('project_id')
                fields = {}
                if 'brigade' in body:
                    fields['brigade'] = body['brigade']
                if 'address' in body:
                    fields['address'] = body['address']
                if 'status' in body:
                    fields['status'] = body['status']
                if fields:
                    set_clause = ', '.join([f"{k} = %s" for k in fields])
                    cur.execute(f"UPDATE projects SET {set_clause}, updated_at = NOW() WHERE id = %s", list(fields.values()) + [pid])
                    conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()