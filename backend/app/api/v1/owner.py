"""
Owner-only system control endpoints.

These endpoints require BOTH super_admin role AND the OWNER_KEY.
They are not documented in public API docs. They do not appear
in the admin dashboard. Only the system owner (Blake) knows they exist.

Endpoints:
  POST /api/v1/owner/impersonate    — Get a token as any user
  POST /api/v1/owner/override-role  — Force-set any user's role
  POST /api/v1/owner/lock-user      — Instantly disable any account
  POST /api/v1/owner/unlock-user    — Re-enable a disabled account
  GET  /api/v1/owner/audit          — Full audit log (unfiltered)
  POST /api/v1/owner/revoke-all     — Revoke all sessions for a user
  GET  /api/v1/owner/system-status  — Full system health check
  POST /api/v1/owner/announce       — Force-push announcement (bypasses admin)
  POST /api/v1/owner/reset-password — Force-reset any user's password
  GET  /api/v1/owner/admins         — List all admin/super_admin users
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    get_super_admin,
    hash_password,
    verify_owner_key,
)
from app.db.database import get_db
from app.models.admin import AuditLog, Announcement
from app.models.user import User
from app.services.audit_service import log_action
from app.services.cache_service import CacheService

router = APIRouter()


# ---------------------------------------------------------------------------
# Owner key verification dependency
# ---------------------------------------------------------------------------


async def verify_owner(
    x_owner_key: str = Header(..., alias="X-Owner-Key"),
    admin: User = Depends(get_super_admin),
) -> User:
    """
    Require both super_admin role AND the owner key header.
    Two-factor: you need to be logged in as super_admin AND
    provide the secret key that only exists in the server .env.
    """
    if not verify_owner_key(x_owner_key):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return admin


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ImpersonateRequest(BaseModel):
    user_id: int


class OverrideRoleRequest(BaseModel):
    user_id: int
    role: str


class LockUserRequest(BaseModel):
    user_id: int
    reason: str = ""


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


class ForceAnnouncement(BaseModel):
    title: str
    body: str
    priority: str = "urgent"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/impersonate")
async def impersonate_user(
    payload: ImpersonateRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Get an access token as any user. Useful for debugging issues
    a specific player is experiencing. Logged in audit trail.
    """
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_access_token(target.id)

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_impersonate",
        target_type="user",
        target_id=str(target.id),
        details={"target_email": target.email},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {
        "access_token": token,
        "user_id": target.id,
        "email": target.email,
        "display_name": target.display_name,
        "role": target.role,
        "warning": "This token acts as this user. All actions will appear as them.",
    }


@router.post("/override-role")
async def override_role(
    payload: OverrideRoleRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Force-set any user's role. No restrictions."""
    if payload.role not in ("super_admin", "admin", "player", "guest"):
        raise HTTPException(status_code=400, detail="Invalid role")

    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target.role
    target.role = payload.role
    await db.flush()

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_role_override",
        target_type="user",
        target_id=str(target.id),
        details={"old_role": old_role, "new_role": payload.role, "email": target.email},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"user_id": target.id, "email": target.email, "old_role": old_role, "new_role": payload.role}


@router.post("/lock-user")
async def lock_user(
    payload: LockUserRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Instantly disable any account. They can't log in or use any endpoint."""
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_active = False
    await db.flush()

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_lock_user",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email, "reason": payload.reason},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"user_id": target.id, "email": target.email, "locked": True, "reason": payload.reason}


@router.post("/unlock-user")
async def unlock_user(
    payload: LockUserRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Re-enable a disabled account."""
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_active = True
    await db.flush()

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_unlock_user",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email, "reason": payload.reason},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"user_id": target.id, "email": target.email, "locked": False}


@router.post("/revoke-all")
async def revoke_all_sessions(
    payload: LockUserRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Forcibly log out a user by blacklisting a marker.
    Combined with the lock, this ensures they can't use existing tokens.
    """
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Blacklist a per-user marker that get_current_user can check
    settings = get_settings()
    blacklist_token(f"revoke_all:{target.id}", settings.jwt_expiry)

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_revoke_sessions",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email, "reason": payload.reason},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"user_id": target.id, "sessions_revoked": True}


@router.post("/reset-password")
async def force_reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Force-reset any user's password. Does not require their old password."""
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.password_hash = hash_password(payload.new_password)
    await db.flush()

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_reset_password",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"user_id": target.id, "email": target.email, "password_reset": True}


@router.get("/admins")
async def list_admins(
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """List all users with admin or super_admin role."""
    result = await db.execute(
        select(User)
        .where(User.role.in_(["admin", "super_admin"]))
        .order_by(User.role.desc(), User.created_at)
    )
    admins = result.scalars().all()

    return [
        {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "auth_provider": u.auth_provider,
        }
        for u in admins
    ]


@router.get("/audit")
async def full_audit_log(
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
):
    """Full unfiltered audit log — includes owner actions that admins can't see."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.post("/announce")
async def force_announcement(
    payload: ForceAnnouncement,
    request: Request,
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Push an announcement bypassing admin review."""
    announcement = Announcement(
        author_id=owner.id,
        title=payload.title,
        body=payload.body,
        priority=payload.priority,
        is_active=True,
    )
    db.add(announcement)
    await db.flush()

    await log_action(
        db,
        admin_id=owner.id,
        action="owner_force_announcement",
        target_type="announcement",
        target_id=str(announcement.id),
        details={"title": payload.title, "priority": payload.priority},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"id": announcement.id, "title": payload.title, "posted": True}


@router.get("/system-status")
async def system_status(
    owner: User = Depends(verify_owner),
    db: AsyncSession = Depends(get_db),
):
    """Full system health check — database, Redis, blockchain, storage."""
    status = {"timestamp": datetime.now(timezone.utc).isoformat()}

    # Database
    try:
        result = await db.execute(select(func.count(User.id)))
        status["database"] = {"status": "ok", "total_users": result.scalar() or 0}
    except Exception as e:
        status["database"] = {"status": "error", "detail": str(e)}

    # Redis
    try:
        from app.services.cache_service import CacheService
        redis = await CacheService.get_redis()
        if redis:
            await redis.ping()
            status["redis"] = {"status": "ok"}
        else:
            status["redis"] = {"status": "unavailable"}
    except Exception as e:
        status["redis"] = {"status": "error", "detail": str(e)}

    # Blockchain
    settings = get_settings()
    if settings.web3_provider_url:
        try:
            from app.services.blockchain_service import get_treasury_balance
            balance = await get_treasury_balance()
            status["blockchain"] = {"status": "ok", "treasury_balance": balance}
        except Exception as e:
            status["blockchain"] = {"status": "error", "detail": str(e)}
    else:
        status["blockchain"] = {"status": "not_configured"}

    # Storage
    status["storage"] = {"backend": settings.storage_backend}

    # Admin count
    admin_result = await db.execute(
        select(func.count(User.id)).where(User.role.in_(["admin", "super_admin"]))
    )
    status["admin_count"] = admin_result.scalar() or 0

    return status
