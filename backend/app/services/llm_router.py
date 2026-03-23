"""
LLM Router — multi-provider AI gateway with cost tracking.

Uses LiteLLM to route to any provider via a single API.
Tracks every call in the llm_usage table for cost analysis.

Supported providers (configured via env vars):
  OPENAI_API_KEY      → GPT-4o-mini (default primary)
  ANTHROPIC_API_KEY   → Claude Haiku/Sonnet
  GEMINI_API_KEY      → Gemini Flash
  GROQ_API_KEY        → Llama on Groq
  OLLAMA_BASE_URL     → Local Ollama (free fallback)

Switch the default model via LLM_MODEL env var.
"""

import json
import logging
import time
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

# Provider pricing per 1M tokens (input, output) — updated March 2026
PRICING = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1-nano": (0.05, 0.20),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4o": (2.50, 10.00),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-sonnet-4-20250514": (3.00, 15.00),
    "gemini/gemini-2.5-flash": (0.30, 2.50),
    "gemini/gemini-2.5-flash-lite": (0.10, 0.40),
    "groq/llama-3.1-8b-instant": (0.05, 0.08),
    "groq/llama-3.3-70b-versatile": (0.59, 0.79),
    "ollama/qwen3:14b": (0.0, 0.0),
    "ollama/llama3.1:8b": (0.0, 0.0),
}


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost in USD for a completion."""
    # Try exact match, then prefix match
    pricing = PRICING.get(model)
    if not pricing:
        for key, val in PRICING.items():
            if key in model or model in key:
                pricing = val
                break
    if not pricing:
        pricing = (0.50, 2.00)  # conservative default

    input_cost = (input_tokens / 1_000_000) * pricing[0]
    output_cost = (output_tokens / 1_000_000) * pricing[1]
    return round(input_cost + output_cost, 6)


def _get_default_model() -> str:
    """Determine the best available model based on configured API keys."""
    settings = get_settings()

    # Check env var override first
    custom = getattr(settings, "llm_model", "") or ""
    if custom:
        return custom

    # Auto-detect from available keys
    openai_key = getattr(settings, "openai_api_key", "") or ""
    anthropic_key = getattr(settings, "anthropic_api_key", "") or ""
    gemini_key = getattr(settings, "gemini_api_key", "") or ""
    groq_key = getattr(settings, "groq_api_key", "") or ""
    ollama_url = getattr(settings, "ollama_base_url", "") or ""

    if openai_key:
        return "gpt-4o-mini"
    if groq_key:
        return "groq/llama-3.1-8b-instant"
    if gemini_key:
        return "gemini/gemini-2.5-flash"
    if anthropic_key:
        return "claude-haiku-4-5-20251001"
    if ollama_url:
        return "ollama/qwen3:14b"

    return ""  # no provider available


async def completion(
    messages: list[dict],
    tools: list[dict] | None = None,
    user_id: int | None = None,
    model: str | None = None,
    max_tokens: int = 800,
    db_session=None,
    endpoint: str = "chat",
) -> dict:
    """
    Send a completion request through LiteLLM.

    Returns: {text, tool_calls, model, input_tokens, output_tokens, cost_usd, latency_ms}
    """
    try:
        import litellm
        litellm.drop_params = True  # don't fail on unsupported params
    except ImportError:
        return {"text": "LLM service not available. Install litellm.", "tool_calls": [], "error": True}

    resolved_model = model or _get_default_model()
    if not resolved_model:
        return {
            "text": "No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, or OLLAMA_BASE_URL in .env",
            "tool_calls": [],
            "error": True,
        }

    start = time.monotonic()
    error_msg = None

    try:
        kwargs: dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools

        # Set Ollama base URL if using local model
        settings = get_settings()
        ollama_url = getattr(settings, "ollama_base_url", "") or ""
        if "ollama/" in resolved_model and ollama_url:
            kwargs["api_base"] = ollama_url

        response = await litellm.acompletion(**kwargs)

        latency_ms = int((time.monotonic() - start) * 1000)

        # Extract results
        text_parts = []
        tool_calls = []

        for choice in response.choices:
            msg = choice.message
            if msg.content:
                text_parts.append(msg.content)
            if msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "input": json.loads(tc.function.arguments) if tc.function.arguments else {},
                    })

        input_tokens = response.usage.prompt_tokens if response.usage else 0
        output_tokens = response.usage.completion_tokens if response.usage else 0
        total_tokens = response.usage.total_tokens if response.usage else 0
        cost = _estimate_cost(resolved_model, input_tokens, output_tokens)

        result = {
            "text": "\n".join(text_parts) if text_parts else "",
            "tool_calls": tool_calls,
            "model": resolved_model,
            "provider": resolved_model.split("/")[0] if "/" in resolved_model else "openai",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost,
            "latency_ms": latency_ms,
            "error": False,
        }

    except Exception as e:
        latency_ms = int((time.monotonic() - start) * 1000)
        error_msg = str(e)[:500]
        logger.error("LLM completion failed (%s): %s", resolved_model, error_msg)

        result = {
            "text": "I'm having trouble connecting to my brain right now. Try again in a moment.",
            "tool_calls": [],
            "model": resolved_model,
            "provider": resolved_model.split("/")[0] if "/" in resolved_model else "unknown",
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "latency_ms": latency_ms,
            "error": True,
        }

    # Log usage to database
    if db_session and user_id:
        try:
            from app.models.llm_usage import LLMUsage
            usage = LLMUsage(
                user_id=user_id,
                provider=result["provider"],
                model=result["model"],
                input_tokens=result["input_tokens"],
                output_tokens=result["output_tokens"],
                total_tokens=result["total_tokens"],
                cost_usd=result["cost_usd"],
                latency_ms=result["latency_ms"],
                success=not result["error"],
                error_message=error_msg,
                endpoint=endpoint,
            )
            db_session.add(usage)
            await db_session.flush()
        except Exception as e:
            logger.warning("Failed to log LLM usage: %s", e)

    return result
