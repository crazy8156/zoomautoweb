from fastapi import APIRouter
from app.api.v1.endpoints import auth, vocab, quiz, user

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(vocab.router)
api_router.include_router(quiz.router)
api_router.include_router(user.router)
