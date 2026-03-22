from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AuditLog


async def log_action(
    db: AsyncSession,
    admin_id: int,
    action: str,
    target_type: str,
    target_id: str,
    details: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Log an admin action to the audit trail."""
    entry = AuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()
    return entry
