"""API endpoints for sticker generation, claiming, and inventory management."""

import csv
import io
import secrets
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.security import get_current_user, get_admin_user
from app.models.user import User
from app.models.disc import RegisteredDisc
from app.models.sticker import (
    StickerOrder,
    StickerInventory,
    StickerOrderStatus,
    StickerInventoryStatus,
)

router = APIRouter(tags=["stickers"])


# === Schemas ===


class GenerateBatchRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=1000, description="Number of codes to generate")
    batch_name: str = Field(..., min_length=1, max_length=100)
    prefix: str = Field(default="RGDG", max_length=10)


class GenerateBatchResponse(BaseModel):
    batch_id: str
    batch_name: str
    quantity: int
    first_code: str
    last_code: str
    codes: List[dict]
    csv_download_url: str


class ClaimStickerRequest(BaseModel):
    manufacturer: Optional[str] = None
    mold: Optional[str] = None
    plastic: Optional[str] = None
    color: Optional[str] = None
    weight_grams: Optional[int] = None


class ClaimStickerResponse(BaseModel):
    success: bool
    disc_code: str
    message: str
    next_step: str


class StickerInventoryItem(BaseModel):
    disc_code: str
    status: str
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None


class BatchInventoryResponse(BaseModel):
    batch_id: str
    batch_name: str
    total: int
    available: int
    claimed: int
    distributed: int
    stickers: List[StickerInventoryItem]


# === Helpers ===


def _generate_disc_code(prefix: str = "RGDG") -> str:
    """Generate a unique disc code. Avoids confusing chars (0/O, 1/I/L)."""
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    suffix = "".join(secrets.choice(chars) for _ in range(4))
    return f"{prefix}-{suffix}"


async def _ensure_unique_code(db: AsyncSession, prefix: str = "RGDG") -> str:
    """Generate a code that doesn't exist in discs or sticker inventory."""
    for _ in range(100):
        code = _generate_disc_code(prefix)
        # Check both tables
        r1 = await db.execute(
            select(RegisteredDisc).where(RegisteredDisc.disc_code == code)
        )
        r2 = await db.execute(
            select(StickerInventory).where(StickerInventory.disc_code == code)
        )
        if r1.scalar_one_or_none() is None and r2.scalar_one_or_none() is None:
            return code
    raise ValueError("Could not generate unique code after 100 attempts")


# === Admin Endpoints ===


@router.post("/generate-batch", response_model=GenerateBatchResponse)
async def generate_sticker_batch(
    request: GenerateBatchRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a batch of disc codes for sticker printing (admin only)."""
    batch_id = f"BATCH-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    order = StickerOrder(
        order_type="bulk",
        status=StickerOrderStatus.GENERATING.value,
        quantity=request.quantity,
        batch_id=batch_id,
        batch_name=request.batch_name,
        user_id=current_user.id,
    )
    db.add(order)
    await db.flush()

    codes = []
    for _ in range(request.quantity):
        code = await _ensure_unique_code(db, request.prefix)
        url = f"https://disc.rgdgc.com/{code}"

        inventory = StickerInventory(
            order_id=order.id,
            disc_code=code,
            qr_url=url,
            status=StickerInventoryStatus.AVAILABLE.value,
        )
        db.add(inventory)
        codes.append({"code": code, "url": url, "short_url": code})

    order.start_code = codes[0]["code"]
    order.end_code = codes[-1]["code"]
    order.status = StickerOrderStatus.PENDING.value

    await db.commit()

    return GenerateBatchResponse(
        batch_id=batch_id,
        batch_name=request.batch_name,
        quantity=len(codes),
        first_code=codes[0]["code"],
        last_code=codes[-1]["code"],
        codes=codes,
        csv_download_url=f"/api/v1/stickers/batch/{batch_id}/csv",
    )


@router.get("/batch/{batch_id}/csv")
async def download_batch_csv(
    batch_id: str,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Download CSV for a batch, ready for Avery mail merge (admin only)."""
    result = await db.execute(
        select(StickerOrder).where(StickerOrder.batch_id == batch_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Batch not found")

    result = await db.execute(
        select(StickerInventory)
        .where(StickerInventory.order_id == order.id)
        .order_by(StickerInventory.disc_code)
    )
    stickers = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["code", "url", "short_url"])
    writer.writeheader()
    for s in stickers:
        writer.writerow({"code": s.disc_code, "url": s.qr_url, "short_url": s.disc_code})

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{batch_id}.csv"'},
    )


@router.get("/batch/{batch_id}/inventory", response_model=BatchInventoryResponse)
async def get_batch_inventory(
    batch_id: str,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get inventory status for a batch (admin only)."""
    result = await db.execute(
        select(StickerOrder).where(StickerOrder.batch_id == batch_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Batch not found")

    result = await db.execute(
        select(StickerInventory)
        .where(StickerInventory.order_id == order.id)
        .order_by(StickerInventory.disc_code)
    )
    stickers = result.scalars().all()

    available = claimed = distributed = 0
    items = []
    for s in stickers:
        if s.status == StickerInventoryStatus.AVAILABLE.value:
            available += 1
        elif s.status == StickerInventoryStatus.CLAIMED.value:
            claimed += 1
        elif s.status == StickerInventoryStatus.DISTRIBUTED.value:
            distributed += 1
        items.append(StickerInventoryItem(
            disc_code=s.disc_code,
            status=s.status,
            claimed_at=s.claimed_at,
        ))

    return BatchInventoryResponse(
        batch_id=batch_id,
        batch_name=order.batch_name,
        total=len(stickers),
        available=available,
        claimed=claimed,
        distributed=distributed,
        stickers=items,
    )


@router.get("/stats")
async def get_sticker_stats(
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Overall sticker statistics (admin only)."""
    result = await db.execute(
        select(StickerInventory.status, func.count(StickerInventory.id)).group_by(
            StickerInventory.status
        )
    )
    status_counts = dict(result.all())

    result = await db.execute(select(func.count(StickerOrder.id)))
    batch_count = result.scalar() or 0

    result = await db.execute(
        select(StickerInventory)
        .where(StickerInventory.status == StickerInventoryStatus.CLAIMED.value)
        .order_by(StickerInventory.claimed_at.desc())
        .limit(10)
    )
    recent_claims = result.scalars().all()

    return {
        "total_stickers": sum(status_counts.values()),
        "available": status_counts.get(StickerInventoryStatus.AVAILABLE.value, 0),
        "claimed": status_counts.get(StickerInventoryStatus.CLAIMED.value, 0),
        "distributed": status_counts.get(StickerInventoryStatus.DISTRIBUTED.value, 0),
        "batch_count": batch_count,
        "recent_claims": [
            {"code": s.disc_code, "claimed_at": s.claimed_at.isoformat() if s.claimed_at else None}
            for s in recent_claims
        ],
    }


# === User Endpoints ===


@router.post("/claim/{disc_code}", response_model=ClaimStickerResponse)
async def claim_sticker(
    disc_code: str,
    request: Optional[ClaimStickerRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim a sticker code — links it to your account and creates a disc record."""
    disc_code = disc_code.upper()

    # Check if already registered as a disc
    result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.disc_code == disc_code)
    )
    existing_disc = result.scalar_one_or_none()

    if existing_disc:
        if existing_disc.owner_id == current_user.id:
            return ClaimStickerResponse(
                success=True,
                disc_code=disc_code,
                message="This disc is already registered to you!",
                next_step=f"/discs/{disc_code}",
            )
        elif existing_disc.owner_id is not None:
            raise HTTPException(status_code=400, detail="This sticker is already claimed by another user")

    # Check sticker inventory
    result = await db.execute(
        select(StickerInventory).where(StickerInventory.disc_code == disc_code)
    )
    inventory = result.scalar_one_or_none()

    if not inventory:
        raise HTTPException(
            status_code=404,
            detail="Invalid sticker code. Make sure you scanned a valid RGDGC sticker.",
        )

    if inventory.status == StickerInventoryStatus.CLAIMED.value:
        if inventory.claimed_by_user_id == current_user.id:
            return ClaimStickerResponse(
                success=True,
                disc_code=disc_code,
                message="This disc is already registered to you!",
                next_step=f"/discs/{disc_code}",
            )
        raise HTTPException(status_code=400, detail="This sticker is already claimed by another user")

    # Update inventory
    inventory.status = StickerInventoryStatus.CLAIMED.value
    inventory.claimed_by_user_id = current_user.id
    inventory.claimed_at = datetime.utcnow()

    # Create disc record if it doesn't exist
    if not existing_disc:
        new_disc = RegisteredDisc(
            disc_code=disc_code,
            owner_id=current_user.id,
            status="active",
            manufacturer=request.manufacturer if request else None,
            mold=request.mold if request else "Unknown",
            plastic=request.plastic if request else None,
            color=request.color if request else None,
            weight_grams=request.weight_grams if request else None,
        )
        db.add(new_disc)

    await db.commit()

    return ClaimStickerResponse(
        success=True,
        disc_code=disc_code,
        message="Sticker claimed successfully! Now add your disc details.",
        next_step=f"/discs/{disc_code}/edit",
    )


@router.get("/validate/{disc_code}")
async def validate_sticker_code(
    disc_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Check if a sticker code is valid and available. Public — no auth required."""
    disc_code = disc_code.upper()

    result = await db.execute(
        select(StickerInventory).where(StickerInventory.disc_code == disc_code)
    )
    inventory = result.scalar_one_or_none()

    if not inventory:
        return {"valid": False, "available": False, "message": "Unknown sticker code"}

    if inventory.status == StickerInventoryStatus.CLAIMED.value:
        return {
            "valid": True,
            "available": False,
            "claimed": True,
            "message": "This sticker is already registered",
        }

    return {"valid": True, "available": True, "message": "Sticker is available to claim"}
