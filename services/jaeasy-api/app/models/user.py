import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)  # None = OAuth
    display_name: Mapped[str] = mapped_column(String(100), default="學習者")
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
