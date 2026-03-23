"""LLM usage analytics — cost tracking dashboard for admins."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Integer, literal, select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.llm_usage import LLMUsage
from app.models.user import User

router = APIRouter()


@router.get("/llm/usage")
async def llm_usage_summary(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get LLM usage summary: total cost, tokens, calls by model and time period."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total stats
    totals = await db.execute(
        select(
            func.count(LLMUsage.id).label("total_calls"),
            func.sum(LLMUsage.input_tokens).label("total_input_tokens"),
            func.sum(LLMUsage.output_tokens).label("total_output_tokens"),
            func.sum(LLMUsage.cost_usd).label("total_cost_usd"),
            func.avg(LLMUsage.latency_ms).label("avg_latency_ms"),
            func.sum(case((LLMUsage.success == False, literal(1)), else_=literal(0))).label("error_count"),
        ).where(LLMUsage.created_at >= since)
    )
    t = totals.one()

    # By model
    by_model = await db.execute(
        select(
            LLMUsage.model,
            LLMUsage.provider,
            func.count(LLMUsage.id).label("calls"),
            func.sum(LLMUsage.cost_usd).label("cost_usd"),
            func.sum(LLMUsage.total_tokens).label("tokens"),
            func.avg(LLMUsage.latency_ms).label("avg_latency"),
        )
        .where(LLMUsage.created_at >= since)
        .group_by(LLMUsage.model, LLMUsage.provider)
        .order_by(func.sum(LLMUsage.cost_usd).desc())
    )

    # By day (for chart)
    by_day = await db.execute(
        select(
            func.date(LLMUsage.created_at).label("date"),
            func.count(LLMUsage.id).label("calls"),
            func.sum(LLMUsage.cost_usd).label("cost_usd"),
        )
        .where(LLMUsage.created_at >= since)
        .group_by(func.date(LLMUsage.created_at))
        .order_by(func.date(LLMUsage.created_at))
    )

    return {
        "period_days": days,
        "totals": {
            "calls": t.total_calls or 0,
            "input_tokens": t.total_input_tokens or 0,
            "output_tokens": t.total_output_tokens or 0,
            "cost_usd": round(float(t.total_cost_usd or 0), 4),
            "avg_latency_ms": round(float(t.avg_latency_ms or 0), 0),
            "error_count": t.error_count or 0,
        },
        "by_model": [
            {
                "model": row.model,
                "provider": row.provider,
                "calls": row.calls,
                "cost_usd": round(float(row.cost_usd or 0), 4),
                "tokens": row.tokens or 0,
                "avg_latency_ms": round(float(row.avg_latency or 0), 0),
            }
            for row in by_model
        ],
        "by_day": [
            {
                "date": str(row.date),
                "calls": row.calls,
                "cost_usd": round(float(row.cost_usd or 0), 4),
            }
            for row in by_day
        ],
    }


@router.get("/llm/config")
async def llm_config(
    admin: User = Depends(get_admin_user),
):
    """Get current LLM configuration (which providers are active)."""
    from app.services.llm_router import _get_default_model, PRICING
    from app.config import get_settings

    settings = get_settings()

    providers = []
    if getattr(settings, "openai_api_key", ""):
        providers.append({"name": "OpenAI", "status": "active", "models": ["gpt-4o-mini", "gpt-4o"]})
    if getattr(settings, "anthropic_api_key", ""):
        providers.append({"name": "Anthropic", "status": "active", "models": ["claude-haiku-4.5", "claude-sonnet-4.5"]})
    if getattr(settings, "gemini_api_key", ""):
        providers.append({"name": "Google", "status": "active", "models": ["gemini-2.5-flash"]})
    if getattr(settings, "groq_api_key", ""):
        providers.append({"name": "Groq", "status": "active", "models": ["llama-3.1-8b"]})
    if getattr(settings, "ollama_base_url", ""):
        providers.append({"name": "Ollama (local)", "status": "active", "models": ["qwen3:14b"]})

    if not providers:
        providers.append({"name": "None configured", "status": "inactive", "models": []})

    return {
        "default_model": _get_default_model() or "none (keyword fallback)",
        "providers": providers,
        "pricing": {k: {"input_per_1m": v[0], "output_per_1m": v[1]} for k, v in PRICING.items()},
    }
