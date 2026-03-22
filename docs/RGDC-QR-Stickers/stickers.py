"""API endpoints for sticker generation and claiming."""
import csv
import io
import secrets
import string
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user, get_current_admin_user, get_current_user_optional
from app.models.user import User
from app.models.disc import RegisteredDisc, DiscStatus
from app.models.sticker import StickerOrder, StickerInventory, StickerOrderStatus, StickerInventoryStatus

router = APIRouter(prefix="/stickers", tags=["stickers"])


# === Schemas ===

class GenerateBatchRequest(BaseModel):
    """Request to generate a batch of disc codes."""
    quantity: int = Field(..., ge=1, le=1000, description="Number of codes to generate")
    batch_name: str = Field(..., min_length=1, max_length=100, description="Name for this batch")
    prefix: str = Field(default="RGDG", max_length=10, description="Code prefix")


class GenerateBatchResponse(BaseModel):
    """Response with generated disc codes."""
    batch_id: str
    batch_name: str
    quantity: int
    first_code: str
    last_code: str
    codes: List[dict]
    csv_download_url: str


class ClaimStickerRequest(BaseModel):
    """Request to claim a sticker."""
    # Optional - user might want to add disc details immediately
    manufacturer: Optional[str] = None
    mold: Optional[str] = None
    plastic: Optional[str] = None
    color: Optional[str] = None
    weight_grams: Optional[int] = None


class ClaimStickerResponse(BaseModel):
    """Response after claiming a sticker."""
    success: bool
    disc_code: str
    message: str
    next_step: str


class StickerInventoryResponse(BaseModel):
    """Sticker inventory item."""
    disc_code: str
    status: str
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None


class BatchInventoryResponse(BaseModel):
    """Full batch inventory."""
    batch_id: str
    batch_name: str
    total: int
    available: int
    claimed: int
    distributed: int
    stickers: List[StickerInventoryResponse]


# === Helper Functions ===

def generate_disc_code(prefix: str = "RGDG") -> str:
    """Generate a unique disc code."""
    # Use URL-safe characters, avoid confusing ones (0/O, 1/I/L)
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    suffix = ''.join(secrets.choice(chars) for _ in range(4))
    return f"{prefix}-{suffix}"


async def ensure_unique_code(db: AsyncSession, prefix: str = "RGDG") -> str:
    """Generate a code that doesn't exist yet."""
    for _ in range(100):  # Max attempts
        code = generate_disc_code(prefix)
        
        # Check both registered_discs and sticker_inventory
        result = await db.execute(
            select(RegisteredDisc).where(RegisteredDisc.disc_code == code)
        )
        if result.scalar_one_or_none() is None:
            result2 = await db.execute(
                select(StickerInventory).where(StickerInventory.disc_code == code)
            )
            if result2.scalar_one_or_none() is None:
                return code
    
    raise ValueError("Could not generate unique code")


# === Admin Endpoints ===

@router.post("/generate-batch", response_model=GenerateBatchResponse)
async def generate_sticker_batch(
    request: GenerateBatchRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a batch of disc codes for sticker printing.
    
    Admin only. Returns codes ready for Avery mail merge.
    """
    # Create batch ID
    batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    
    # Create the order record
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
    
    # Generate codes
    codes = []
    for i in range(request.quantity):
        code = await ensure_unique_code(db, request.prefix)
        url = f"https://disc.rgdgc.com/{code}"
        
        # Create inventory record
        inventory = StickerInventory(
            order_id=order.id,
            disc_code=code,
            qr_url=url,
            status=StickerInventoryStatus.AVAILABLE.value,
        )
        db.add(inventory)
        
        codes.append({
            "code": code,
            "url": url,
            "short_url": code,
        })
    
    # Update order with first/last codes
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
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Download CSV file for a batch, ready for Avery mail merge.
    """
    # Get order
    result = await db.execute(
        select(StickerOrder).where(StickerOrder.batch_id == batch_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get stickers
    result = await db.execute(
        select(StickerInventory)
        .where(StickerInventory.order_id == order.id)
        .order_by(StickerInventory.disc_code)
    )
    stickers = result.scalars().all()
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["code", "url", "short_url"])
    writer.writeheader()
    
    for sticker in stickers:
        writer.writerow({
            "code": sticker.disc_code,
            "url": sticker.qr_url,
            "short_url": sticker.disc_code,
        })
    
    # Return as downloadable file
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{batch_id}.csv"'
        }
    )


@router.get("/batch/{batch_id}/inventory", response_model=BatchInventoryResponse)
async def get_batch_inventory(
    batch_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get inventory status for a batch.
    """
    # Get order
    result = await db.execute(
        select(StickerOrder).where(StickerOrder.batch_id == batch_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get stickers with claimed user info
    result = await db.execute(
        select(StickerInventory)
        .where(StickerInventory.order_id == order.id)
        .order_by(StickerInventory.disc_code)
    )
    stickers = result.scalars().all()
    
    # Build response
    sticker_items = []
    available = claimed = distributed = 0
    
    for s in stickers:
        if s.status == StickerInventoryStatus.AVAILABLE.value:
            available += 1
        elif s.status == StickerInventoryStatus.CLAIMED.value:
            claimed += 1
        elif s.status == StickerInventoryStatus.DISTRIBUTED.value:
            distributed += 1
        
        sticker_items.append(StickerInventoryResponse(
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
        stickers=sticker_items,
    )


# === User Endpoints ===

@router.post("/claim/{disc_code}", response_model=ClaimStickerResponse)
async def claim_sticker(
    disc_code: str,
    request: ClaimStickerRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Claim a sticker code - links it to your account.
    
    Called when a user scans a sticker they received at an event.
    """
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
            raise HTTPException(
                status_code=400,
                detail="This sticker is already claimed by another user"
            )
        else:
            # Unclaimed disc record exists - claim it
            existing_disc.owner_id = current_user.id
            existing_disc.status = DiscStatus.ACTIVE.value
            existing_disc.registered_at = datetime.utcnow()
            
            # Update disc details if provided
            if request:
                if request.manufacturer:
                    existing_disc.manufacturer = request.manufacturer
                if request.mold:
                    existing_disc.mold = request.mold
                if request.plastic:
                    existing_disc.plastic = request.plastic
                if request.color:
                    existing_disc.color = request.color
                if request.weight_grams:
                    existing_disc.weight_grams = request.weight_grams
    
    # Check if in sticker inventory
    result = await db.execute(
        select(StickerInventory).where(StickerInventory.disc_code == disc_code)
    )
    inventory = result.scalar_one_or_none()
    
    if inventory:
        if inventory.status == StickerInventoryStatus.CLAIMED.value:
            if inventory.claimed_by_user_id == current_user.id:
                return ClaimStickerResponse(
                    success=True,
                    disc_code=disc_code,
                    message="This disc is already registered to you!",
                    next_step=f"/discs/{disc_code}",
                )
            raise HTTPException(
                status_code=400,
                detail="This sticker is already claimed by another user"
            )
        
        # Update inventory
        inventory.status = StickerInventoryStatus.CLAIMED.value
        inventory.claimed_by_user_id = current_user.id
        inventory.claimed_at = datetime.utcnow()
        
        # Create disc record if doesn't exist
        if not existing_disc:
            new_disc = RegisteredDisc(
                disc_code=disc_code,
                owner_id=current_user.id,
                status=DiscStatus.ACTIVE.value,
                manufacturer=request.manufacturer if request else None,
                mold=request.mold if request else None,
                plastic=request.plastic if request else None,
                color=request.color if request else None,
                weight_grams=request.weight_grams if request else None,
            )
            db.add(new_disc)
    else:
        # Code not in inventory - might be invalid
        raise HTTPException(
            status_code=404,
            detail="Invalid sticker code. Make sure you scanned a valid RGDGC sticker."
        )
    
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
    """
    Check if a sticker code is valid and available.
    
    Public endpoint - no auth required.
    """
    disc_code = disc_code.upper()
    
    # Check inventory
    result = await db.execute(
        select(StickerInventory).where(StickerInventory.disc_code == disc_code)
    )
    inventory = result.scalar_one_or_none()
    
    if not inventory:
        return {
            "valid": False,
            "available": False,
            "message": "Unknown sticker code",
        }
    
    # Check if already claimed
    if inventory.status == StickerInventoryStatus.CLAIMED.value:
        # Check the disc record
        result = await db.execute(
            select(RegisteredDisc).where(RegisteredDisc.disc_code == disc_code)
        )
        disc = result.scalar_one_or_none()
        
        return {
            "valid": True,
            "available": False,
            "claimed": True,
            "disc_name": disc.display_name if disc else None,
            "message": "This sticker is already registered",
        }
    
    return {
        "valid": True,
        "available": True,
        "message": "Sticker is available to claim",
    }


# === Stats ===

@router.get("/stats")
async def get_sticker_stats(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get overall sticker statistics (admin only).
    """
    # Count by status
    result = await db.execute(
        select(
            StickerInventory.status,
            func.count(StickerInventory.id)
        ).group_by(StickerInventory.status)
    )
    status_counts = dict(result.all())
    
    # Count batches
    result = await db.execute(
        select(func.count(StickerOrder.id))
    )
    batch_count = result.scalar() or 0
    
    # Recent claims
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
            {
                "code": s.disc_code,
                "claimed_at": s.claimed_at.isoformat() if s.claimed_at else None,
            }
            for s in recent_claims
        ],
    }
