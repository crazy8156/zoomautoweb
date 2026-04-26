"""
範例種子資料腳本
用法: python scripts/seed_vocab.py
"""
import asyncio
import sys
sys.path.append(".")

from app.db.base import AsyncSessionLocal
from app.models.vocabulary import Vocabulary, JLPTLevel

SAMPLE_VOCAB = [
    # (word, reading, meaning_zh, pos, level)
    ("食べる", "たべる", "吃", "動詞", JLPTLevel.N5),
    ("飲む", "のむ", "喝", "動詞", JLPTLevel.N5),
    ("電車", "でんしゃ", "電車、列車", "名詞", JLPTLevel.N4),
    ("確認", "かくにん", "確認、核實", "名詞・動詞", JLPTLevel.N3),
    ("影響", "えいきょう", "影響", "名詞・動詞", JLPTLevel.N2),
]

async def seed():
    async with AsyncSessionLocal() as db:
        for word, reading, meaning, pos, level in SAMPLE_VOCAB:
            db.add(Vocabulary(word=word, reading=reading, meaning_zh=meaning, pos=pos, jlpt_level=level))
        await db.commit()
        print(f"✅ 已匯入 {len(SAMPLE_VOCAB)} 筆單字")

if __name__ == "__main__":
    asyncio.run(seed())
