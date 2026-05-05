"""
ERP: Платежи — создание, список, P&L и ДДС агрегаты
"""
import json
import os
import psycopg2
from datetime import date, datetime


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    if hasattr(obj, '__float__'):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def handler(event: dict, context) -> dict:
    """Платежи, P&L, ДДС"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == 'GET':
            # P&L агрегат по направлениям
            cur.execute("""
                SELECT
                  COALESCE(category, 'Прочее') as category,
                  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
                FROM payments
                WHERE payment_date >= date_trunc('month', CURRENT_DATE)
                GROUP BY category
            """)
            pl_rows = [{'category': r[0], 'income': float(r[1] or 0), 'expense': float(r[2] or 0)} for r in cur.fetchall()]

            # ДДС итог
            cur.execute("""
                SELECT
                  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
                  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
                FROM payments
                WHERE payment_date >= date_trunc('month', CURRENT_DATE)
            """)
            r = cur.fetchone()
            dds = {'income': float(r[0] or 0), 'expense': float(r[1] or 0)}

            # Последние платежи
            cur.execute("""
                SELECT p.id, p.code, p.type, p.category, p.amount, p.payment_date, p.description,
                       pr.code as project_code,
                       c.name as client_name
                FROM payments p
                LEFT JOIN projects pr ON p.project_id = pr.id
                LEFT JOIN clients c ON pr.client_id = c.id
                ORDER BY p.payment_date DESC, p.id DESC
                LIMIT 50
            """)
            cols = [d[0] for d in cur.description]
            payments = [dict(zip(cols, r)) for r in cur.fetchall()]

            # Проекты для формы
            cur.execute("SELECT id, code FROM projects WHERE status = 'active' ORDER BY code")
            projects = [{'id': r[0], 'code': r[1]} for r in cur.fetchall()]

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'payments': payments, 'pl': pl_rows, 'dds': dds, 'projects': projects}, default=json_serial)
            }

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            project_id = body.get('project_id')
            deal_id = body.get('deal_id')
            ptype = body.get('type', 'income')
            category = body.get('category', '')
            amount = body.get('amount')
            payment_date = body.get('payment_date')
            description = body.get('description', '')

            if not amount or not payment_date:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'amount и payment_date обязательны'})}

            cur.execute("SELECT COUNT(*) FROM payments")
            count = cur.fetchone()[0]
            code = f"ПЛТ-{count + 1:04d}"

            cur.execute("""
                INSERT INTO payments (code, project_id, deal_id, type, category, amount, payment_date, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, code
            """, (code, project_id, deal_id, ptype, category, amount, payment_date, description))
            pay_id, pay_code = cur.fetchone()
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'success': True, 'payment_id': pay_id, 'code': pay_code})
            }

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()