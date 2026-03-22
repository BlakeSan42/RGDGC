from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    tx_type: Mapped[str] = mapped_column(String(30), nullable=False)  # event_fee, prize, deposit, withdrawal
    amount: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    tx_hash: Mapped[str | None] = mapped_column(String(66), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, confirmed, failed
    event_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("events.id"), nullable=True)
    from_address: Mapped[str | None] = mapped_column(String(42))
    to_address: Mapped[str | None] = mapped_column(String(42))
    block_number: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="transactions")
