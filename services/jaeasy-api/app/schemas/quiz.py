from pydantic import BaseModel
from app.models.quiz import QuizType
from app.models.vocabulary import JLPTLevel

class QuizQuestionOut(BaseModel):
    id: int
    type: QuizType
    jlpt_level: JLPTLevel
    question: str
    options: list[str]
    # answer_index 不輸出（前端不能看答案）

    model_config = {"from_attributes": True}

class AttemptRequest(BaseModel):
    selected_index: int

class AttemptResult(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str | None

class QuizStats(BaseModel):
    total_attempts: int
    correct_count: int
    accuracy: float
