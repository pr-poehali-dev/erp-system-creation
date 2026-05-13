import os
import json
import time
import requests
import traceback

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT = 120

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

EXCEL_PROMPT = """Ты — ассистент для извлечения данных из счетов.
Я передаю содержимое таблицы счёта в формате TSV (Tab-Separated Values).

Извлеки ВСЕ позиции без исключений. Для каждой позиции:
- material: полное название товара/материала (не сокращай, включая размеры, артикулы, марки)
- quantity: число (может быть дробным)
- unit: единица измерения (м3, шт, м, пог.м, м2, т, кг и т.д.)
- unit_price: цена за единицу
- amount: сумма строки (unit_price × quantity)

В шапке документа найди:
- supplier_name: название поставщика/организации
- invoice_date: дата счёта в формате YYYY-MM-DD
- invoice_number: номер счёта

ПРАВИЛА:
1. Строки-заголовки таблицы (№, Наименование, Кол-во, Ед.изм., Цена, Сумма и т.п.) — пропускай.
2. Итоговые строки (Итого, НДС, Всего) — не включай в items, но значение «Итого» запиши в footer_total.
3. Если значение отсутствует — ставь null.
4. Числа — только цифры, без пробелов и символов валюты.
5. Не добавляй комментариев и пояснений.

Верни ТОЛЬКО строгий JSON без markdown-обёрток:
{"supplier_name":"...","invoice_date":"YYYY-MM-DD","invoice_number":"...","footer_total":число,"items":[{"material":"...","quantity":число,"unit":"...","unit_price":число,"amount":число}]}"""


def _parse_json(raw: str) -> dict:
    s = raw.strip()
    # Убираем markdown-обёртки
    for prefix in ["```json", "```"]:
        if s.startswith(prefix):
            s = s[len(prefix):]
    s = s.rstrip("`").strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    # Ищем самый длинный JSON-объект
    import re
    matches = re.findall(r'\{[\s\S]+\}', s)
    for m in sorted(matches, key=len, reverse=True):
        try:
            return json.loads(m)
        except Exception:
            continue
    return {}


def _call_deepseek(messages: list, attempt: int = 1) -> str:
    """Вызов DeepSeek API с одной автоматической повторной попыткой."""
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY не настроен")

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 8192,
    }

    try:
        resp = requests.post(
            DEEPSEEK_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json=payload,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        if attempt < 2:
            time.sleep(2)
            return _call_deepseek(messages, attempt + 1)
        raise e


def _excel_b64_to_tsv_chunks(excel_b64: str, chunk_size: int = 20) -> list[str]:
    """Декодирует Excel из base64 и разбивает на TSV-чанки по chunk_size строк."""
    import base64
    import io

    raw = base64.b64decode(excel_b64)

    # Пробуем xlsx через openpyxl, затем xls через xlrd
    rows = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            rows.append([str(c) if c is not None else "" for c in row])
        wb.close()
    except Exception:
        try:
            import xlrd
            wb = xlrd.open_workbook(file_contents=raw)
            ws = wb.sheet_by_index(0)
            for ri in range(ws.nrows):
                rows.append([str(ws.cell_value(ri, ci)) for ci in range(ws.ncols)])
        except Exception as e2:
            raise ValueError(f"Не удалось прочитать Excel: {e2}")

    # Убираем пустые строки
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        raise ValueError("Excel пустой или не содержит данных")

    # Первые 5 строк — шапка (может содержать поставщика, дату, номер)
    # Всегда добавляем к каждому чанку
    header_rows = rows[:5]
    data_rows   = rows[5:]  # остальные — данные

    chunks = []
    if not data_rows:
        # Весь файл < 5 строк — отправляем целиком
        tsv = "\n".join("\t".join(r) for r in rows)
        chunks.append(tsv)
    else:
        for i in range(0, len(data_rows), chunk_size):
            chunk = header_rows + data_rows[i : i + chunk_size]
            tsv = "\n".join("\t".join(r) for r in chunk)
            chunks.append(tsv)

    return chunks


def _merge_results(results: list[dict]) -> dict:
    """Объединяет результаты нескольких чанков в один."""
    if not results:
        return {}
    merged = {
        "supplier_name":  None,
        "invoice_date":   None,
        "invoice_number": None,
        "footer_total":   None,
        "items":          [],
    }
    for r in results:
        if isinstance(r, dict):
            if not merged["supplier_name"]  and r.get("supplier_name"):  merged["supplier_name"]  = r["supplier_name"]
            if not merged["invoice_date"]   and r.get("invoice_date"):   merged["invoice_date"]   = r["invoice_date"]
            if not merged["invoice_number"] and r.get("invoice_number"): merged["invoice_number"] = r["invoice_number"]
            if r.get("footer_total") is not None:                        merged["footer_total"]   = r["footer_total"]
            if isinstance(r.get("items"), list):
                merged["items"].extend(r["items"])
    return merged


def handler(event: dict, context) -> dict:
    """Извлечение данных из Excel-счёта через DeepSeek API.

    Принимает POST с телом:
    {
      "excel_b64": "<base64 содержимого Excel-файла>",
      "file_name": "invoice.xlsx"   // опционально
    }
    Возвращает:
    {
      "supplier_name": "...",
      "invoice_date": "YYYY-MM-DD",
      "invoice_number": "...",
      "footer_total": число | null,
      "items": [{"material":"...","quantity":...,"unit":"...","unit_price":...,"amount":...}],
      "chunks_processed": N
    }
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": CORS_HEADERS, "body": json.dumps({"error": "Method not allowed"})}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Invalid JSON"})}

    excel_b64 = body.get("excel_b64", "")
    if not excel_b64:
        return {"statusCode": 400, "headers": CORS_HEADERS,
                "body": json.dumps({"error": "excel_b64 обязателен"})}

    try:
        chunks = _excel_b64_to_tsv_chunks(excel_b64, chunk_size=20)
    except ValueError as e:
        return {"statusCode": 400, "headers": CORS_HEADERS,
                "body": json.dumps({"error": str(e)})}
    except Exception as e:
        return {"statusCode": 500, "headers": CORS_HEADERS,
                "body": json.dumps({"error": f"Ошибка чтения Excel: {e}"})}

    results = []
    errors  = []

    for i, tsv_chunk in enumerate(chunks):
        messages = [
            {
                "role": "system",
                "content": "Ты — система извлечения данных из счетов. Отвечай ТОЛЬКО строгим JSON без пояснений.",
            },
            {
                "role": "user",
                "content": f"{EXCEL_PROMPT}\n\nДанные счёта (TSV):\n{tsv_chunk}",
            },
        ]
        try:
            raw = _call_deepseek(messages)
            parsed = _parse_json(raw)
            if parsed:
                results.append(parsed)
        except Exception as e:
            errors.append(f"Чанк {i+1}: {e}")

    if not results and errors:
        return {"statusCode": 502, "headers": CORS_HEADERS,
                "body": json.dumps({"error": "DeepSeek не ответил: " + "; ".join(errors)})}

    merged = _merge_results(results)
    merged["chunks_processed"] = len(chunks)

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps(merged, ensure_ascii=False),
    }
