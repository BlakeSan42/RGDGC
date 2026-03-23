"""
Intel API — Intelligence monitoring endpoints for RGDGC admins.

All endpoints require admin authentication.
Provides CRUD for intel reports, digest generation, and search.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.services.intel_service import (
    generate_report,
    get_latest_per_category,
    get_latest_summary,
    get_report_by_id,
    get_report_digest,
    get_reports,
    report_to_dict,
    search_reports,
    VALID_CATEGORIES,
)

router = APIRouter()


# ── Request/Response schemas ──


class ManualContent(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1)
    key_findings: list[str] | None = None
    sources: list[dict[str, str]] | None = None
    sentiment: str = Field(default="neutral")
    relevance_score: float = Field(default=0.5, ge=0.0, le=1.0)


class GenerateReportRequest(BaseModel):
    category: str = Field(..., description="Report category: ksa, river_grove, disc_golf, club, general")
    manual_content: ManualContent | None = None


class ManualReportRequest(BaseModel):
    category: str = Field(..., description="Report category: ksa, river_grove, disc_golf, club, general")
    title: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1)
    key_findings: list[str] | None = None
    sources: list[dict[str, str]] | None = None
    sentiment: str = Field(default="neutral")
    relevance_score: float = Field(default=0.5, ge=0.0, le=1.0)


class IntelReportResponse(BaseModel):
    id: int
    report_date: str
    category: str
    title: str
    summary: str
    key_findings: list[str] | None = None
    sources: list[dict[str, Any]] | None = None
    search_queries: list[str] | None = None
    sentiment: str
    relevance_score: float
    created_by: int
    created_at: str | None = None


class DigestResponse(BaseModel):
    digest: str
    days: int


# ── Endpoints ──


@router.post("/reports/generate", response_model=IntelReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_intel_report(
    data: GenerateReportRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger report generation for a category (admin only).

    If manual_content is provided, creates a report with that content.
    Otherwise, creates a template report for the category.
    """
    try:
        manual = None
        if data.manual_content:
            manual = data.manual_content.model_dump()

        report = await generate_report(
            db=db,
            category=data.category,
            admin_id=admin.id,
            manual_content=manual,
        )
        return IntelReportResponse(**report_to_dict(report))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/reports/manual", response_model=IntelReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_manual_report(
    data: ManualReportRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a manually written intel report (admin only).

    This is the MVP workflow: admin researches a topic and pastes findings here.
    """
    try:
        manual_content = {
            "title": data.title,
            "summary": data.summary,
            "key_findings": data.key_findings,
            "sources": data.sources,
            "sentiment": data.sentiment,
            "relevance_score": data.relevance_score,
        }
        report = await generate_report(
            db=db,
            category=data.category,
            admin_id=admin.id,
            manual_content=manual_content,
        )
        return IntelReportResponse(**report_to_dict(report))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/reports", response_model=list[IntelReportResponse])
async def list_reports(
    category: str | None = Query(None, description="Filter by category"),
    start_date: date | None = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="Filter to date (YYYY-MM-DD)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List intel reports with optional filters (admin only)."""
    try:
        reports = await get_reports(
            db=db,
            category=category,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )
        return [IntelReportResponse(**report_to_dict(r)) for r in reports]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/reports/latest", response_model=list[IntelReportResponse])
async def latest_reports(
    category: str | None = Query(None, description="Get latest for specific category, or all if omitted"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest report per category, or for a specific category (admin only)."""
    try:
        if category:
            report = await get_latest_summary(db, category)
            return [IntelReportResponse(**report_to_dict(report))] if report else []
        else:
            reports = await get_latest_per_category(db)
            return [IntelReportResponse(**report_to_dict(r)) for r in reports]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/reports/digest", response_model=DigestResponse)
async def weekly_digest(
    days: int = Query(7, ge=1, le=90, description="Number of days to include"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a formatted text digest of recent intel reports (admin only).

    Designed for bot consumption — returns a pre-formatted text block
    that Clawd can include in chat responses.
    """
    digest = await get_report_digest(db, days=days)
    return DigestResponse(digest=digest, days=days)


@router.get("/reports/search", response_model=list[IntelReportResponse])
async def search_intel_reports(
    q: str = Query(..., min_length=1, description="Search keyword"),
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Search across all intel reports by keyword (admin only)."""
    reports = await search_reports(db, query=q, limit=limit)
    return [IntelReportResponse(**report_to_dict(r)) for r in reports]


@router.get("/reports/{report_id}", response_model=IntelReportResponse)
async def get_single_report(
    report_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single intel report by ID (admin only)."""
    report = await get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return IntelReportResponse(**report_to_dict(report))


@router.get("/categories", response_model=list[str])
async def list_categories(
    admin: User = Depends(get_admin_user),
):
    """List valid report categories."""
    return sorted(VALID_CATEGORIES)
