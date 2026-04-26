"""
SM-2 間隔重複演算法
ref: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

grade 評分標準:
  5 - 完美回答
  4 - 正確但有些遲疑
  3 - 正確但很費力
  2 - 錯誤，但看到答案後覺得很近
  1 - 錯誤，但看到答案後有印象
  0 - 完全不記得
"""

from datetime import datetime, timedelta, timezone

def calculate_next_review(
    grade: int,
    repetitions: int,
    ease_factor: float,
    interval_days: float,
) -> dict:
    """
    Returns: { interval_days, ease_factor, repetitions, next_review_at }
    """
    if grade < 3:
        # 答錯：重置，明天重新開始
        repetitions = 0
        interval_days = 1.0
    else:
        # 答對
        if repetitions == 0:
            interval_days = 1.0
        elif repetitions == 1:
            interval_days = 6.0
        else:
            interval_days = round(interval_days * ease_factor, 1)
        repetitions += 1

    # 更新 ease factor（最低 1.3）
    ease_factor = max(1.3, ease_factor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    ease_factor = round(ease_factor, 3)

    next_review_at = datetime.now(timezone.utc) + timedelta(days=interval_days)

    return {
        "interval_days": interval_days,
        "ease_factor": ease_factor,
        "repetitions": repetitions,
        "last_grade": grade,
        "next_review_at": next_review_at,
    }
