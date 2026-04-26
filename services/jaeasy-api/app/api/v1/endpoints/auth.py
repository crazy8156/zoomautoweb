from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.auth_service import register_user, login_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, summary="註冊新帳號")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(req, db)

@router.post("/login", response_model=TokenResponse, summary="登入取得 Token")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(req, db)
