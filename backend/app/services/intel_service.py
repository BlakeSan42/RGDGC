"""
Intel Service — Intelligence monitoring and daily reports for RGDGC.

Handles report generation, querying, digesting, and full-text search.
Reports are admin-only: manually submitted findings or (future) automated web search.
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import or_, select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intel_report import IntelReport

logger = logging.getLogger(__name__)

# ── Category search queries (for future automated search integration) ──

CATEGORY_QUERIES: dict[str, list[str]] = {
    "ksa": [
        "KSA Kingwood",
        "Kingwood Service Association",
        "KSA HOA Kingwood TX",
    ],
    "river_grove": [
        "River Grove Park Kingwood TX",
        "River Grove disc golf",
    ],
    "disc_golf": [
        "disc golf Houston TX",
        "disc golf league Texas",
        "PDGA Texas events",
    ],
    "club": [
        "River Grove Disc Golf Club",
        "RGDGC Kingwood",
    ],
    "general": [
        "disc golf news",
        "disc golf equipment 2026",
    ],
}

VALID_CATEGORIES = set(CATEGORY_QUERIES.keys())

VALID_SENTIMENTS = {"positive", "negative", "neutral", "mixed"}


def _validate_category(category: str) -> str:
    """Validate and return category, raise ValueError if invalid."""
    cat = category.lower().strip()
    if cat not in VALID_CATEGORIES:
        raise ValueError(f"Invalid category '{category}'. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
    return cat


def _validate_sentiment(sentiment: str) -> str:
    """Validate and return sentiment, raise ValueError if invalid."""
    sent = sentiment.lower().strip()
    if sent not in VALID_SENTIMENTS:
        raise ValueError(f"Invalid sentiment '{sentiment}'. Must be one of: {', '.join(sorted(VALID_SENTIMENTS))}")
    return sent


async def generate_report(
    db: AsyncSession,
    category: str,
    admin_id: int,
    manual_content: dict[str, Any] | None = None,
) -> IntelReport:
    """
    Create a new intel report for a given category.

    If manual_content is provided, uses it directly:
        {title, summary, key_findings?: list[str], sources?: list[dict], sentiment?, relevance_score?}
    Otherwise, creates a template report that can be filled in later.
    """
    cat = _validate_category(category)
    today = date.today()

    if manual_content:
        title = manual_content.get("title", "").strip()
        summary = manual_content.get("summary", "").strip()
        if not title or not summary:
            raise ValueError("manual_content must include 'title' and 'summary'")

        key_findings = manual_content.get("key_findings")
        sources = manual_content.get("sources")
        sentiment = _validate_sentiment(manual_content.get("sentiment", "neutral"))
        relevance_score = max(0.0, min(1.0, float(manual_content.get("relevance_score", 0.5))))
    else:
        # Template report — placeholder for future automated web search
        queries = CATEGORY_QUERIES.get(cat, [])
        title = f"{cat.replace('_', ' ').title()} Daily Brief — {today.isoformat()}"
        summary = (
            f"Template report for category '{cat}'. "
            f"Search queries to investigate: {', '.join(queries)}. "
            f"Replace this summary with actual findings."
        )
        key_findings = ["No findings yet — edit this report with actual data"]
        sources = []
        sentiment = "neutral"
        relevance_score = 0.5

    report = IntelReport(
        report_date=today,
        category=cat,
        title=title,
        summary=summary,
        key_findings=json.dumps(key_findings) if key_findings else None,
        sources=json.dumps(sources) if sources else None,
        search_queries=json.dumps(CATEGORY_QUERIES.get(cat, [])),
        sentiment=sentiment,
        relevance_score=relevance_score,
        created_by=admin_id,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    logger.info("Intel report created: id=%d category=%s by admin=%d", report.id, cat, admin_id)
    return report


async def get_reports(
    db: AsyncSession,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[IntelReport]:
    """Query stored reports with optional filters."""
    query = select(IntelReport).order_by(desc(IntelReport.report_date), desc(IntelReport.created_at))

    if category:
        query = query.where(IntelReport.category == _validate_category(category))
    if start_date:
        query = query.where(IntelReport.report_date >= start_date)
    if end_date:
        query = query.where(IntelReport.report_date <= end_date)

    query = query.offset(offset).limit(min(limit, 100))

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_report_by_id(db: AsyncSession, report_id: int) -> IntelReport | None:
    """Get a single report by ID."""
    result = await db.execute(select(IntelReport).where(IntelReport.id == report_id))
    return result.scalar_one_or_none()


async def get_latest_summary(db: AsyncSession, category: str) -> IntelReport | None:
    """Get the most recent report for a category."""
    cat = _validate_category(category)
    result = await db.execute(
        select(IntelReport)
        .where(IntelReport.category == cat)
        .order_by(desc(IntelReport.report_date), desc(IntelReport.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_latest_per_category(db: AsyncSession) -> list[IntelReport]:
    """Get the most recent report for each category."""
    reports = []
    for cat in sorted(VALID_CATEGORIES):
        report = await get_latest_summary(db, cat)
        if report:
            reports.append(report)
    return reports


async def get_report_digest(db: AsyncSession, days: int = 7) -> str:
    """
    Combine recent reports into a weekly digest string that the Clawd bot can use.
    Returns formatted text suitable for inclusion in chat context.
    """
    cutoff = date.today() - timedelta(days=days)
    result = await db.execute(
        select(IntelReport)
        .where(IntelReport.report_date >= cutoff)
        .order_by(IntelReport.category, desc(IntelReport.report_date))
    )
    reports = result.scalars().all()

    if not reports:
        return f"No intel reports in the last {days} days."

    lines = [f"=== RGDGC Intel Digest ({days}-day) ===\n"]
    current_category = None

    for r in reports:
        if r.category != current_category:
            current_category = r.category
            lines.append(f"\n--- {current_category.replace('_', ' ').upper()} ---")

        lines.append(f"\n[{r.report_date.isoformat()}] {r.title}")
        lines.append(f"Sentiment: {r.sentiment} | Relevance: {r.relevance_score:.1f}")
        # Truncate summary for digest
        summary = r.summary[:300] + "..." if len(r.summary) > 300 else r.summary
        lines.append(summary)

        if r.key_findings:
            try:
                findings = json.loads(r.key_findings)
                for f in findings[:3]:
                    lines.append(f"  - {f}")
            except (json.JSONDecodeError, TypeError):
                pass

    lines.append(f"\n=== {len(reports)} report(s) total ===")
    return "\n".join(lines)


async def search_reports(db: AsyncSession, query: str, limit: int = 10) -> list[IntelReport]:
    """
    Full-text search across report summaries, titles, and key findings.
    Uses SQL ILIKE for simplicity (works on both PostgreSQL and SQLite).
    """
    if not query or not query.strip():
        return []

    search_term = f"%{query.strip()}%"
    result = await db.execute(
        select(IntelReport)
        .where(
            or_(
                IntelReport.title.ilike(search_term),
                IntelReport.summary.ilike(search_term),
                IntelReport.key_findings.ilike(search_term),
            )
        )
        .order_by(desc(IntelReport.relevance_score), desc(IntelReport.report_date))
        .limit(min(limit, 50))
    )
    return list(result.scalars().all())


def report_to_dict(report: IntelReport) -> dict[str, Any]:
    """Serialize an IntelReport to a dictionary."""
    return {
        "id": report.id,
        "report_date": report.report_date.isoformat(),
        "category": report.category,
        "title": report.title,
        "summary": report.summary,
        "key_findings": _safe_json_load(report.key_findings),
        "sources": _safe_json_load(report.sources),
        "search_queries": _safe_json_load(report.search_queries),
        "sentiment": report.sentiment,
        "relevance_score": report.relevance_score,
        "created_by": report.created_by,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _safe_json_load(text: str | None) -> list | None:
    """Parse JSON text, returning None on failure."""
    if not text:
        return None
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
