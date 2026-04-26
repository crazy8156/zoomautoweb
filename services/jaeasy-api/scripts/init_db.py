"""
建立所有資料表（首次部署用，不走 alembic）
用法: python scripts/init_db.py
"""
import asyncio
import sys
sys.path.append(".")

from app.db.base import Base, engine
from app.models import user, vocabulary, quiz  # noqa: F401  register metadata


async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("OK tables created")


if __name__ == "__main__":
    asyncio.run(init())
