"""
ERP: K_company — пересчёт коэффициента скорости компании.
Формула: (продажи_факт/план)×0.4 + (сдано_домов/план)×0.3 + (62/ср_длительность)×0.2 + (1.0/норма)×0.1
Если K < 0.8 — фиксируется alert_sent=True (для уведомления директору).
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


S = 't_p60494808_erp_system_creation'

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def json_serial(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if hasattr(obj, '__float__'):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def calculate_k(cur) -> dict:
    today = date.today()

    # Нормативы
    def norm(key, default):
        cur.execute("SELECT value FROM system_norms WHERE key = %s", (key,))
        r = cur.fetchone()
        return float(r[0]) if r else default

    sales_plan = norm('sales_plan_month', 20_000_000)
    houses_plan = norm('houses_plan_month', 4)
    build_days_norm = norm('build_days', 62)

    # Факт продаж (текущий месяц)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE type = 'income'
          AND payment_date >= date_trunc('month', CURRENT_DATE)
    """)
    sales_fact = float(cur.fetchone()[0])

    # Сдано домов в текущем месяце
    cur.execute("""
        SELECT COUNT(*) FROM projects
        WHERE status = 'completed'
          AND updated_at >= date_trunc('month', CURRENT_DATE)
    """)
    houses_fact = cur.fetchone()[0]

    # Средняя длительность завершённых проектов
    cur.execute("""
        SELECT AVG(EXTRACT(DAY FROM (deadline - start_date)))
        FROM projects
        WHERE status = 'completed'
    """)
    avg_dur = cur.fetchone()[0]
    avg_dur = float(avg_dur) if avg_dur else build_days_norm

    # K компоненты
    k_sales = min((sales_fact / sales_plan) if sales_plan > 0 else 0, 1.0)
    k_prod = min((houses_fact / houses_plan) if houses_plan > 0 else 0, 1.0)
    k_speed = min((build_days_norm / avg_dur) if avg_dur > 0 else 0, 1.0)
    k_turnover = 1.0  # заглушка до подключения складского оборота

    k_total = round(k_sales * 0.4 + k_prod * 0.3 + k_speed * 0.2 + k_turnover * 0.1, 4)

    return {
        'k_total': k_total,
        'k_sales': round(k_sales, 4),
        'k_production': round(k_prod, 4),
        'k_speed': round(k_speed, 4),
        'k_turnover': round(k_turnover, 4),
        'sales_fact': sales_fact,
        'sales_plan': sales_plan,
        'houses_fact': houses_fact,
        'houses_plan': int(houses_plan),
        'avg_duration_days': round(avg_dur, 2),
        'alert': k_total < 0.8,
        'calc_date': today.isoformat(),
    }


def handler(event: dict, context) -> dict:
    """K_company: пересчёт и история"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == 'GET':
            # Последнее значение из лога
            cur.execute("""
                SELECT calc_date, k_total, k_sales, k_production, k_speed, k_turnover,
                       sales_fact, sales_plan, houses_fact, houses_plan, avg_duration_days, alert_sent
                FROM k_company_log
                ORDER BY calc_date DESC, id DESC
                LIMIT 1
            """)
            row = cur.fetchone()

            if row:
                cols = ['calc_date', 'k_total', 'k_sales', 'k_production', 'k_speed', 'k_turnover',
                        'sales_fact', 'sales_plan', 'houses_fact', 'houses_plan', 'avg_duration_days', 'alert_sent']
                last = dict(zip(cols, row))
            else:
                last = None

            # История за 30 дней
            cur.execute("""
                SELECT calc_date, k_total FROM k_company_log
                ORDER BY calc_date DESC LIMIT 30
            """)
            history = [{'date': r[0].isoformat(), 'k': float(r[1])} for r in cur.fetchall()]

            # Живой расчёт
            live = calculate_k(cur)

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'last': last, 'live': live, 'history': history}, default=json_serial)
            }

        if method == 'POST':
            # Принудительный пересчёт (или по расписанию)
            data = calculate_k(cur)
            today = date.today()

            cur.execute("""
                INSERT INTO k_company_log
                  (calc_date, k_total, k_sales, k_production, k_speed, k_turnover,
                   sales_fact, sales_plan, houses_fact, houses_plan, avg_duration_days, alert_sent)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                today,
                data['k_total'], data['k_sales'], data['k_production'],
                data['k_speed'], data['k_turnover'],
                data['sales_fact'], data['sales_plan'],
                data['houses_fact'], data['houses_plan'],
                data['avg_duration_days'],
                data['alert'],
            ))
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'success': True, 'data': data}, default=json_serial)
            }

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()