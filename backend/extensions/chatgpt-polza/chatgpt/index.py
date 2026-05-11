"""
ChatGPT Text Generation Function

OpenAI GPT models via Polza.ai provider.

Actions:
- generate: Generate text completion
- models: List available GPT models
- test: Test API connection
"""

import json
import os
from dataclasses import dataclass
from typing import Optional

import requests


# =============================================================================
# CONFIGURATION
# =============================================================================

# Provider: Polza.ai (OpenAI-compatible API)
PROVIDER_BASE_URL = "https://api.polza.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-4o-mini"
DEFAULT_TIMEOUT = 60



@dataclass
class Message:
    role: str
    content: str


# =============================================================================
# CORS HELPERS
# =============================================================================

def get_cors_headers() -> dict:
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    return {
        "Access-Control-Allow-Origin": allowed_origins,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def options_response() -> dict:
    return {
        "statusCode": 204,
        "headers": get_cors_headers(),
        "body": "",
    }


# =============================================================================
# API HELPERS
# =============================================================================

def get_api_key() -> str:
    api_key = os.environ.get("POLZA_AI_API_KEY", "")
    if not api_key:
        raise ValueError("POLZA_AI_API_KEY not configured")
    return api_key


def make_request(endpoint: str, method: str = "POST", data: Optional[dict] = None) -> dict:
    """Make request to provider API."""
    api_key = get_api_key()
    url = f"{PROVIDER_BASE_URL}/{endpoint}"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=DEFAULT_TIMEOUT)
        else:
            response = requests.post(url, headers=headers, json=data, timeout=DEFAULT_TIMEOUT)

        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        raise TimeoutError("API timeout")
    except requests.exceptions.ConnectionError:
        raise ConnectionError("API unavailable")
    except requests.exceptions.HTTPError as e:
        error_body = {}
        try:
            error_body = e.response.json()
        except Exception:
            pass
        raise ValueError(error_body.get("error", {}).get("message", str(e)))


# =============================================================================
# ACTION HANDLERS
# =============================================================================

def handle_generate(body: dict) -> dict:
    """
    POST ?action=generate
    Generate text completion.

    Body:
    - messages: list of {role, content} - required
    - model: string - optional (default: openai/gpt-4o-mini)
    - temperature: float - optional (default: 0.7)
    - max_tokens: int - optional
    """
    messages = body.get("messages", [])
    if not messages:
        return cors_response(400, {"error": "messages is required"})

    model = body.get("model", DEFAULT_MODEL)
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens")

    # Validate model starts with openai/
    if not model.startswith("openai/"):
        return cors_response(400, {
            "error": "This extension only supports OpenAI models (openai/*)"
        })

    request_data = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }

    if max_tokens:
        request_data["max_tokens"] = max_tokens

    try:
        result = make_request("chat/completions", data=request_data)

        choice = result.get("choices", [{}])[0]
        message = choice.get("message", {})
        usage = result.get("usage", {})

        return cors_response(200, {
            "success": True,
            "content": message.get("content", ""),
            "model": result.get("model", model),
            "usage": {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
            "finish_reason": choice.get("finish_reason", "stop"),
        })
    except (TimeoutError, ConnectionError) as e:
        return cors_response(503, {"error": str(e)})
    except ValueError as e:
        return cors_response(400, {"error": str(e)})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_models(body: dict) -> dict:
    """
    GET/POST ?action=models
    List available GPT models from Polza.ai.
    """
    try:
        result = make_request("models", method="GET")

        # Filter only OpenAI models
        models = []
        for model in result.get("data", []):
            model_id = model.get("id", "")
            if model_id.startswith("openai/"):
                models.append({
                    "id": model_id,
                    "name": model_id.replace("openai/", "").upper(),
                })

        return cors_response(200, {
            "success": True,
            "models": models,
            "provider": "polza.ai",
        })
    except (TimeoutError, ConnectionError) as e:
        return cors_response(503, {"error": str(e)})
    except ValueError as e:
        return cors_response(400, {"error": str(e)})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_test(body: dict) -> dict:
    """
    POST ?action=test
    Test API connection with a simple request.
    """
    model = body.get("model", DEFAULT_MODEL)

    try:
        result = make_request("chat/completions", data={
            "model": model,
            "messages": [{"role": "user", "content": "Say 'OK' if you can hear me."}],
            "max_tokens": 10,
        })

        choice = result.get("choices", [{}])[0]
        content = choice.get("message", {}).get("content", "")

        return cors_response(200, {
            "success": True,
            "message": "ChatGPT connection successful",
            "response": content,
            "model": result.get("model", model),
        })
    except (TimeoutError, ConnectionError) as e:
        return cors_response(503, {"error": str(e)})
    except ValueError as e:
        return cors_response(400, {"error": str(e)})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


# =============================================================================
# MAIN HANDLER
# =============================================================================

def handler(event: dict, context) -> dict:
    """Main entry point."""
    method = event.get("httpMethod", "POST")

    if method == "OPTIONS":
        return options_response()

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if not action:
        return cors_response(400, {"error": "action parameter is required"})

    body = {}
    if method == "POST":
        raw_body = event.get("body", "{}")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})

    if action == "generate":
        return handle_generate(body)
    elif action == "models":
        return handle_models(body)
    elif action == "test":
        return handle_test(body)
    else:
        return cors_response(400, {"error": f"Unknown action: {action}"})
