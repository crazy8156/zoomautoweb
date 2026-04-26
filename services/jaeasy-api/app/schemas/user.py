from pydantic import BaseModel
from datetime import datetime
import uuid

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_vip: bool
    streak_days: int
    created_at: datetime

    model_config = {"from_attributes": True}
