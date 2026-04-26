from pydantic import BaseModel
from datetime import datetime
from app.models.vocabulary import JLPTLevel

class VocabOut(BaseModel):
    id: int
    word: str
    reading: str
    meaning_zh: str
    pos: str
    jlpt_level: JLPTLevel
    audio_url: str | None
    example_ja: str | None
    example_zh: str | None

    model_config = {"from_attributes": True}

class SRSState(BaseModel):
    vocab_id: int
    interval_days: float
    ease_factor: float
    repetitions: int
    next_review_at: datetime

    model_config = {"from_attributes": True}

class GradeRequest(BaseModel):
    grade: int  # 0~5 (SM-2)

class ReviewItem(BaseModel):
    vocab: VocabOut
    srs: SRSState
