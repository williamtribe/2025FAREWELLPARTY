from __future__ import annotations

import secrets
from typing import Annotated, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import logger, settings
from .services import (
    assemble_profile_record,
    embedding_service,
    intro_generation_service,
    kakao_client,
    normalize_profile_text,
    pinecone_service,
    session_signer,
    supabase_service,
)

app = FastAPI(title="2025 Farewell Party API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
        settings.base_url.rstrip("/"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionUser(BaseModel):
    kakao_id: str
    nickname: Optional[str] = None
    is_admin: bool = False


class ProfilePayload(BaseModel):
    name: str
    intro: str
    tagline: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    contact: Optional[str] = None
    visibility: Literal["public", "private", "members"] = "public"


class PreferencePayload(BaseModel):
    answers: Dict[str, str]
    mood: Optional[str] = None


class KakaoMessagePayload(BaseModel):
    access_token: str
    receiver_uuids: List[str]
    text: Optional[str] = None


async def optional_user(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> SessionUser | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = session_signer.verify(token)
        return SessionUser(**payload)
    except ValueError:
        return None


async def get_current_user(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> SessionUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = session_signer.verify(token)
        return SessionUser(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/auth/kakao/login")
async def kakao_login():
    state = secrets.token_urlsafe(16)
    auth_url = await kakao_client.build_login_url(state)
    return {"auth_url": str(auth_url), "state": state}


@app.get("/auth/kakao/callback")
async def kakao_callback(code: str, state: Optional[str] = None):
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_code")
    try:
        token_data = await kakao_client.exchange_code_for_token(code)
    except Exception as exc:  # surface Kakao error body to client
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"kakao_token_error: {exc}",
        ) from exc
    try:
        user_info = await kakao_client.fetch_user(token_data["access_token"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"kakao_user_error: {exc}",
        ) from exc

    kakao_id = str(user_info["id"])
    nickname = (
        user_info.get("kakao_account", {})
        .get("profile", {})
        .get("nickname", "친구")
    )
    payload = {
        "kakao_id": kakao_id,
        "nickname": nickname,
        "is_admin": kakao_id in settings.admin_ids,
    }
    session_token = session_signer.sign(payload)
    return {"session_token": session_token, "profile": payload, "state": state}


@app.get("/me")
async def get_my_profile(user: SessionUser = Depends(get_current_user)):
    profile = supabase_service.fetch_profile(user.kakao_id)
    return {"profile": profile}


@app.put("/me")
async def upsert_profile(payload: ProfilePayload, user: SessionUser = Depends(get_current_user)):
    record = assemble_profile_record(user.kakao_id, payload.model_dump())
    supabase_result = supabase_service.upsert_profile(record)

    # Embed and push to Pinecone.
    embedding_vector = embedding_service.embed_member(normalize_profile_text(record))
    pinecone_result = None
    if embedding_vector:
        pinecone_result = pinecone_service.upsert_embedding(
            member_id=user.kakao_id,
            vector=embedding_vector,
            metadata={"visibility": record["visibility"], "name": record["name"]},
        )

    return {
        "profile": record,
        "supabase": supabase_result.get("data") if isinstance(supabase_result, dict) else supabase_result,
        "pinecone": pinecone_result,
    }


@app.post("/preferences")
async def save_preferences(payload: PreferencePayload, user: SessionUser = Depends(get_current_user)):
    data = {
        "kakao_id": user.kakao_id,
        "answers": payload.answers,
        "mood": payload.mood,
    }
    supabase_result = supabase_service.upsert_preferences(data)
    return {"preferences": data, "supabase": supabase_result}


class IntroGenerationPayload(BaseModel):
    answers: Dict[str, str]


@app.post("/generate-intro")
async def generate_intro(payload: IntroGenerationPayload, user: SessionUser = Depends(get_current_user)):
    result = intro_generation_service.generate_intro(payload.answers)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="intro_generation_failed",
        )
    return result


class YesOrNoPayload(BaseModel):
    question_num: int = Field(..., ge=1, le=5)
    response: int = Field(..., ge=-1, le=1)


@app.post("/intro-yesorno")
async def save_yesorno(payload: YesOrNoPayload, user: SessionUser = Depends(get_current_user)):
    if payload.response not in (-1, 1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="response must be -1 or 1")
    result = supabase_service.upsert_yesorno(user.kakao_id, payload.question_num, payload.response)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return {"saved": True, "result": result}


@app.get("/intro-yesorno")
async def get_yesorno(user: SessionUser = Depends(get_current_user)):
    row = supabase_service.fetch_yesorno(user.kakao_id)
    return {"responses": row}


@app.get("/profiles/public")
async def list_public_profiles(limit: int = 6):
    profiles = supabase_service.fetch_public_profiles(limit=limit)
    return {"profiles": profiles}


@app.get("/profiles/{kakao_id}")
async def view_profile(
    kakao_id: str,
    user: SessionUser | None = Depends(optional_user),
):
    profile = supabase_service.fetch_profile(kakao_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    is_owner = user and user.kakao_id == kakao_id
    is_admin = user.is_admin if user else False

    if profile.get("visibility") == "private" and not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return {"profile": profile}

@app.get("/admin/profiles")
async def admin_profiles(user: SessionUser = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    if not supabase_service.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="supabase_not_configured",
        )
    result = supabase_service.client.table("member_profiles").select("*").execute()
    return {"profiles": result.data}


@app.get("/kakao/friends")
async def kakao_friends(access_token: str, user: SessionUser = Depends(get_current_user)):
    try:
        friends = await kakao_client.fetch_friends(access_token)
        return {"friends": friends}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"kakao_friends_error: {exc}") from exc


@app.post("/kakao/message")
async def kakao_message(payload: KakaoMessagePayload, user: SessionUser = Depends(get_current_user)):
    if not payload.receiver_uuids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="receiver_uuids_required")
    text = payload.text or f"{user.nickname or '친구'}가 송년회 초대장을 보냈습니다. 페이지를 확인해 주세요."
    try:
        result = await kakao_client.send_friend_message(
            access_token=payload.access_token,
            receiver_uuids=payload.receiver_uuids,
            text=text,
            link_url=settings.base_url,
        )
        return {"sent": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"kakao_message_error: {exc}") from exc
