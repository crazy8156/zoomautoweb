from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
from app.db.base import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.vocabulary import Vocabulary, UserVocabSRS, JLPTLevel
from app.schemas.vocab import VocabOut, GradeRequest, ReviewItem, SRSState
from app.services.srs import calculate_next_review

router = APIRouter(prefix="/vocab", tags=["vocabulary"])

@router.get("", response_model=list[VocabOut], summary="取得單字列表")
async def list_vocab(
    level: JLPTLevel = Query(..., description="JLPT 等級"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Vocabulary)
        .where(Vocabulary.jlpt_level == level)
        .offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.get("/review/today", response_model=list[ReviewItem], summary="取得今日 SRS 複習清單")
async def get_today_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserVocabSRS, Vocabulary)
        .join(Vocabulary, UserVocabSRS.vocab_id == Vocabulary.id)
        .where(
            and_(
                UserVocabSRS.user_id == current_user.id,
                UserVocabSRS.next_review_at <= now,
            )
        )
        .limit(50)
    )
    rows = result.all()
    return [
        ReviewItem(
            vocab=VocabOut.model_validate(vocab),
            srs=SRSState.model_validate(srs),
        )
        for srs, vocab in rows
    ]

@router.post("/{vocab_id}/grade", summary="提交 SM-2 評分")
async def grade_vocab(
    vocab_id: int,
    req: GradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (0 <= req.grade <= 5):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="grade 必須在 0~5 之間")

    result = await db.execute(
        select(UserVocabSRS).where(
            and_(UserVocabSRS.user_id == current_user.id, UserVocabSRS.vocab_id == vocab_id)
        )
    )
    srs = result.scalar_one_or_none()

    if srs is None:
        # 第一次學習這個單字
        srs = UserVocabSRS(
            user_id=current_user.id,
            vocab_id=vocab_id,
            next_review_at=datetime.now(timezone.utc),
        )
        db.add(srs)

    updates = calculate_next_review(req.grade, srs.repetitions, srs.ease_factor, srs.interval_days)
    for k, v in updates.items():
        setattr(srs, k, v)

    await db.commit()
    return {"next_review_at": updates["next_review_at"], "interval_days": updates["interval_days"]}
