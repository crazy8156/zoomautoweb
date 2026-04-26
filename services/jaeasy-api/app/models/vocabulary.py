import enum
from datetime import datetime
import uuid
from sqlalchemy import String, Text, Enum, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class JLPTLevel(str, enum.Enum):
    N5 = "N5"
    N4 = "N4"
    N3 = "N3"
    N2 = "N2"
    N1 = "N1"

class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(100), nullable=False)        # 漢字
    reading: Mapped[str] = mapped_column(String(200), nullable=False)     # ふりがな
    meaning_zh: Mapped[str] = mapped_column(String(500), nullable=False)  # 中文意思
    pos: Mapped[str] = mapped_column(String(50), default="")              # 詞性
    jlpt_level: Mapped[JLPTLevel] = mapped_column(Enum(JLPTLevel), nullable=False, index=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    example_ja: Mapped[str | None] = mapped_column(Text, nullable=True)   # 例句
    example_zh: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserVocabSRS(Base):
    """
    SM-2 間隔重複複習狀態
    每個 (user_id, vocab_id) 組合一筆紀錄
    """
    __tablename__ = "user_vocab_srs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vocab_id: Mapped[int] = mapped_column(ForeignKey("vocabulary.id", ondelete="CASCADE"))

    # SM-2 欄位
    interval_days: Mapped[float] = mapped_column(Float, default=1.0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    last_grade: Mapped[int] = mapped_column(Integer, default=0)   # 0~5
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
