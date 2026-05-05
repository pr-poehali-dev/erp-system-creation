"""
ERP: Дашборд — сводная статистика для главной страницы
"""
import json
import os
import psycopg2
from datetime import date, datetime


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    """Сводная статистика дашборда"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = get_conn()
    cur = conn.cursor()

    try:
        # Выручка месяца
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM payments
            WHERE type = 'income' AND payment_date >= date_trunc('month', CURRENT_DATE)
        """)
        revenue = float(cur.fetchone()[0])

        # Активных проектов
        cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'active'")
        active_projects = cur.fetchone()[0]

        # Сделок в CRM
        cur.execute("SELECT COUNT(*) FROM deals WHERE stage NOT IN ('lost', 'contract')")
        crm_deals = cur.fetchone()[0]

        # Просрочено этапов
        cur.execute("""
            SELECT COUNT(*) FROM project_stages
            WHERE status IN ('pending', 'active') AND planned_end < CURRENT_DATE
        """)
        overdue_stages = cur.fetchone()[0]

        # Заявок на закупку
        cur.execute("SELECT COUNT(*) FROM material_requests WHERE status IN ('new', 'ordered')")
        pending_materials = cur.fetchone()[0]

        # Последний K_company
        cur.execute("SELECT k_total FROM k_company_log ORDER BY calc_date DESC, id DESC LIMIT 1")
        row = cur.fetchone()
        k_company = float(row[0]) if row else None

        # Активные проекты (топ-5)
        cur.execute("""
            SELECT p.code, p.deadline, p.status,
                   c.name as client_name,
                   (SELECT ps.name FROM project_stages ps WHERE ps.project_id = p.id AND ps.status = 'active' LIMIT 1) as current_stage,
                   (SELECT COUNT(*) FROM project_stages ps WHERE ps.project_id = p.id) as total_stages,
                   (SELECT COUNT(*) FROM project_stages ps WHERE ps.project_id = p.id AND ps.status = 'done') as done_stages
            FROM projects p
            LEFT JOIN clients c ON p.client_id = c.id
            WHERE p.status = 'active'
            ORDER BY p.deadline ASC
            LIMIT 5
        """)
        cols = [d[0] for d in cur.description]
        recent_projects = [dict(zip(cols, r)) for r in cur.fetchall()]

        # Уведомления (просрочки + задачи прорабу)
        alerts = []
        cur.execute("""
            SELECT p.code, ps.name, ps.planned_end
            FROM project_stages ps
            JOIN projects p ON ps.project_id = p.id
            WHERE ps.status IN ('pending', 'active') AND ps.planned_end < CURRENT_DATE
            ORDER BY ps.planned_end ASC LIMIT 5
        """)
        for r in cur.fetchall():
            alerts.append({'text': f"Отставание: {r[0]} — этап «{r[1]}»", 'type': 'error', 'time': r[2].strftime('%d.%m.%y') if r[2] else ''})

        cur.execute("""
            SELECT title, created_at FROM foreman_tasks WHERE status = 'open' ORDER BY created_at DESC LIMIT 3
        """)
        for r in cur.fetchall():
            alerts.append({'text': r[0], 'type': 'warning', 'time': r[1].strftime('%d.%m') if r[1] else ''})

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'kpi': {
                    'revenue': revenue,
                    'active_projects': active_projects,
                    'crm_deals': crm_deals,
                    'k_company': k_company,
                    'overdue_stages': overdue_stages,
                    'pending_materials': pending_materials,
                },
                'recent_projects': recent_projects,
                'alerts': alerts,
            }, default=json_serial)
        }

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()