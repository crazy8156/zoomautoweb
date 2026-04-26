from fastapi import APIRouter, Depends
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/user", tags=["user"])

@router.get("/me", response_model=UserOut, summary="取得目前登入用戶資訊")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
