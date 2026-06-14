from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.auth import create_access_token, APP_USERNAME, APP_PASSWORD

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    if body.username != APP_USERNAME or body.password != APP_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    return LoginResponse(access_token=create_access_token(body.username))
