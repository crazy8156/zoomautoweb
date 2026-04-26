import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, Enum, JSON, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.models.vocabulary import JLPTLevel

class QuizType(str, enum.Enum):
    vocab = "vocab"
    grammar = "grammar"
    reading = "reading"

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[QuizType] = mapped_column(Enum(QuizType), nullable=False, index=True)
    jlpt_level: Mapped[JLPTLevel] = mapped_column(Enum(JLPTLevel), nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)   # ["選項A","選項B","選項C","選項D"]
    answer_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"))
    selected_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
