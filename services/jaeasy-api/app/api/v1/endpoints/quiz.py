from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer
from app.db.base import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.quiz import QuizQuestion, QuizAttempt, QuizType
from app.models.vocabulary import JLPTLevel
from app.schemas.quiz import QuizQuestionOut, AttemptRequest, AttemptResult, QuizStats

router = APIRouter(prefix="/quiz", tags=["quiz"])

@router.get("", response_model=list[QuizQuestionOut], summary="取得測驗題目")
async def get_quiz(
    level: JLPTLevel = Query(...),
    type: QuizType = Query(QuizType.vocab),
    count: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.jlpt_level == level, QuizQuestion.type == type)
        .order_by(func.random())
        .limit(count)
    )
    return result.scalars().all()

@router.post("/{question_id}/attempt", response_model=AttemptResult, summary="提交答案")
async def submit_attempt(
    question_id: int,
    req: AttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="題目不存在")

    is_correct = req.selected_index == q.answer_index
    attempt = QuizAttempt(
        user_id=current_user.id,
        question_id=question_id,
        selected_index=req.selected_index,
        is_correct=is_correct,
    )
    db.add(attempt)
    await db.commit()

    return AttemptResult(
        is_correct=is_correct,
        correct_index=q.answer_index,
        explanation=q.explanation,
    )

@router.get("/stats", response_model=QuizStats, summary="取得答題統計")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            func.count(QuizAttempt.id),
            func.sum(QuizAttempt.is_correct.cast(Integer)),
        ).where(QuizAttempt.user_id == current_user.id)
    )
    total, correct = result.one()
    total = total or 0
    correct = int(correct or 0)
    return QuizStats(
        total_attempts=total,
        correct_count=correct,
        accuracy=round(correct / total * 100, 1) if total else 0.0,
    )
