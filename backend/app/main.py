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
    normalize_intro_text,
    normalize_interests_text,
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
    profile_image_url: Optional[str] = None
    is_admin: bool = False


class ProfilePayload(BaseModel):
    name: str
    intro: str
    tagline: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    contact: Optional[str] = None
    profile_image: Optional[str] = None
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
    kakao_account = user_info.get("kakao_account", {})
    profile_data = kakao_account.get("profile", {})
    nickname = profile_data.get("nickname", "친구")
    profile_image_url = profile_data.get("profile_image_url", "")
    
    # Update profile_image for existing users on every login
    if profile_image_url:
        existing_profile = supabase_service.fetch_profile(kakao_id)
        if existing_profile:
            supabase_service.update_profile_image(kakao_id, profile_image_url)
    
    payload = {
        "kakao_id": kakao_id,
        "nickname": nickname,
        "profile_image_url": profile_image_url,
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

    metadata = {"visibility": record["visibility"], "name": record["name"]}
    pinecone_results = {}

    intro_text = normalize_intro_text(record)
    if intro_text.strip():
        intro_vector = embedding_service.embed_member(intro_text)
        if intro_vector:
            pinecone_results["intro"] = pinecone_service.upsert_embedding(
                member_id=user.kakao_id,
                vector=intro_vector,
                metadata=metadata,
                namespace="intro",
            )

    interests_text = normalize_interests_text(record)
    if interests_text.strip():
        interests_vector = embedding_service.embed_member(interests_text)
        if interests_vector:
            pinecone_results["interests"] = pinecone_service.upsert_embedding(
                member_id=user.kakao_id,
                vector=interests_vector,
                metadata=metadata,
                namespace="interests",
            )

    return {
        "profile": record,
        "supabase": supabase_result.get("data") if isinstance(supabase_result, dict) else supabase_result,
        "pinecone": pinecone_results if pinecone_results else None,
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


@app.post("/generate-intro-from-yesorno")
async def generate_intro_from_yesorno(user: SessionUser = Depends(get_current_user)):
    yesorno_data = supabase_service.fetch_yesorno(user.kakao_id)
    if not yesorno_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="yesorno_data_not_found")
    
    has_responses = any(yesorno_data.get(str(i)) in (1, -1) for i in range(1, 6))
    if not has_responses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_responses_found")
    
    result = intro_generation_service.generate_intro_from_yesorno(yesorno_data, user.nickname or "친구")
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="intro_generation_failed",
        )
    return result


@app.get("/profiles/count")
async def get_profiles_count():
    if not supabase_service.client:
        return {"count": 0}
    try:
        result = supabase_service.client.table("member_profiles").select("kakao_id", count="exact").execute()
        return {"count": result.count or 0}
    except Exception:
        return {"count": 0}


@app.get("/profiles/public")
async def list_public_profiles(limit: int = 50):
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


@app.post("/admin/reembed-all")
async def reembed_all_profiles(user: SessionUser = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    if not supabase_service.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="supabase_not_configured",
        )
    
    result = supabase_service.client.table("member_profiles").select("*").execute()
    profiles = result.data or []
    
    stats = {"total": len(profiles), "intro_success": 0, "interests_success": 0, "errors": []}
    
    for profile in profiles:
        kakao_id = profile.get("kakao_id")
        if not kakao_id:
            continue
            
        metadata = {"visibility": profile.get("visibility", "public"), "name": profile.get("name", "")}
        
        intro_text = normalize_intro_text(profile)
        if intro_text.strip():
            intro_vector = embedding_service.embed_member(intro_text)
            if intro_vector:
                try:
                    pinecone_service.upsert_embedding(
                        member_id=kakao_id,
                        vector=intro_vector,
                        metadata=metadata,
                        namespace="intro",
                    )
                    stats["intro_success"] += 1
                except Exception as e:
                    stats["errors"].append(f"intro:{kakao_id}:{str(e)}")
        
        interests_text = normalize_interests_text(profile)
        if interests_text.strip():
            interests_vector = embedding_service.embed_member(interests_text)
            if interests_vector:
                try:
                    pinecone_service.upsert_embedding(
                        member_id=kakao_id,
                        vector=interests_vector,
                        metadata=metadata,
                        namespace="interests",
                    )
                    stats["interests_success"] += 1
                except Exception as e:
                    stats["errors"].append(f"interests:{kakao_id}:{str(e)}")
    
    return {"message": "reembedding_complete", "stats": stats}


@app.get("/admin/profiles-order")
async def get_profiles_order(user: SessionUser = Depends(get_current_user)):
    """Get all profiles for admin to manage display order."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    profiles = supabase_service.fetch_all_profiles_for_admin()
    return {"profiles": profiles}


class OrderItem(BaseModel):
    kakao_id: str
    display_order: int


class UpdateOrderPayload(BaseModel):
    orders: list[OrderItem]


@app.post("/admin/profiles-order")
async def update_profiles_order(payload: UpdateOrderPayload, user: SessionUser = Depends(get_current_user)):
    """Update display order for profiles (admin only)."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    orders = [{"kakao_id": item.kakao_id, "display_order": item.display_order} for item in payload.orders]
    result = supabase_service.update_display_order(orders)
    if result.get("skipped"):
        if result.get("reason") == "display_order_column_not_exists":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="display_order 컬럼이 없습니다. Supabase에서 추가해주세요: ALTER TABLE member_profiles ADD COLUMN display_order INTEGER DEFAULT 999;"
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("reason"))
    return {"message": "order_updated", "result": result}


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


@app.get("/similar-profiles")
async def get_similar_profiles(
    user: SessionUser = Depends(get_current_user), 
    limit: int = 10,
    criteria: Literal["intro", "interests"] = "intro"
):
    namespace = criteria
    matches = pinecone_service.query_similar(user.kakao_id, top_k=limit, namespace=namespace)
    if not matches:
        return {"profiles": [], "message": "no_embedding_found", "criteria": criteria}
    profiles = []
    for match in matches:
        profile = supabase_service.fetch_profile(match["kakao_id"])
        if profile and profile.get("visibility") == "public":
            profiles.append({
                **profile,
                "similarity_score": match["score"],
            })
    return {"profiles": profiles, "criteria": criteria}


@app.get("/different-profiles")
async def get_different_profiles(
    user: SessionUser = Depends(get_current_user), 
    limit: int = 10,
    criteria: Literal["intro", "interests"] = "intro"
):
    namespace = criteria
    matches = pinecone_service.query_different(user.kakao_id, top_k=limit, namespace=namespace)
    if not matches:
        return {"profiles": [], "message": "no_embedding_found", "criteria": criteria}
    profiles = []
    for match in matches:
        profile = supabase_service.fetch_profile(match["kakao_id"])
        if profile and profile.get("visibility") == "public":
            profiles.append({
                **profile,
                "similarity_score": match["score"],
            })
    return {"profiles": profiles, "criteria": criteria}


MAFIA42_ROLES = {
    "마피아팀": ["마피아", "스파이", "짐승인간", "마담", "도둑", "마녀", "과학자", "사기꾼", "청부업자", "악인"],
    "시민팀": ["경찰", "자경단원", "요원", "의사", "군인", "정치인", "영매", "연인", "건달", "기자", 
              "사립탐정", "도굴꾼", "테러리스트", "성직자", "예언자", "판사", "간호사", "마술사", 
              "해커", "심리학자", "용병", "공무원", "비밀결사", "파파라치", "최면술사", "점쟁이", "시민"],
    "교주팀": ["교주", "광신도"],
}


class RoleAssignmentPayload(BaseModel):
    name: str = ""
    tagline: str = ""
    intro: str = ""
    interests: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)


@app.post("/role-assignment")
async def assign_mafia_role(
    payload: RoleAssignmentPayload, 
    user: SessionUser = Depends(get_current_user)
):
    from openai import OpenAI
    import json
    
    openai_key = settings.openai_api_key
    if not openai_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openai_not_configured"
        )
    
    client = OpenAI(api_key=openai_key)
    
    all_roles = []
    for team, roles in MAFIA42_ROLES.items():
        for role in roles:
            all_roles.append(f"{team}: {role}")
    
    profile_text = f"""
이름: {payload.name}
한 줄 소개: {payload.tagline}
자기소개: {payload.intro}
관심사: {', '.join(payload.interests)}
특기: {', '.join(payload.strengths)}
"""
    
    system_prompt = f"""당신은 마피아42 게임의 직업 배정 전문가입니다.
사용자의 프로필을 분석해서 가장 어울리는 마피아42 직업을 배정해주세요.

⚠️ 중요: 아래 목록에 있는 직업만 사용하세요! 목록에 없는 직업(변호사, 교사, 의사 등 현실 직업)은 절대 사용하지 마세요!

【마피아팀】 마피아, 스파이, 짐승인간, 마담, 도둑, 마녀, 과학자, 사기꾼, 청부업자, 악인
【시민팀】 경찰, 자경단원, 요원, 의사, 군인, 정치인, 영매, 연인, 건달, 기자, 사립탐정, 도굴꾼, 테러리스트, 성직자, 예언자, 판사, 간호사, 마술사, 해커, 심리학자, 용병, 공무원, 비밀결사, 파파라치, 최면술사, 점쟁이, 시민
【교주팀】 교주, 광신도

반드시 위 목록에서만 선택하고, 다음 JSON 형식으로만 응답하세요:
{{"team": "마피아팀/시민팀/교주팀 중 하나", "role": "위 목록의 직업명", "reasoning": "왜 이 직업이 어울리는지 2-3문장으로 재미있게 설명"}}

예시:
{{"team": "시민팀", "role": "해커", "reasoning": "AI와 프로그래밍에 관심이 많고 데이터를 다루는 당신! 디지털 세계에서 정보를 캐내는 해커가 딱이에요."}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"다음 프로필을 분석해서 마피아42 직업을 배정해주세요:\n{profile_text}"},
            ],
            temperature=0.8,
            max_tokens=300,
        )
        
        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        result = json.loads(result_text)
        team = result.get("team", "시민팀")
        role = result.get("role", "시민")
        reasoning = result.get("reasoning", "당신은 평범하지만 특별한 시민입니다!")
        
        valid_role = False
        for t, roles in MAFIA42_ROLES.items():
            if role in roles:
                team = t
                valid_role = True
                break
        
        if not valid_role:
            import random
            team = random.choice(list(MAFIA42_ROLES.keys()))
            role = random.choice(MAFIA42_ROLES[team])
            reasoning = f"AI가 살짝 헷갈렸지만, 당신에게 어울리는 {role}(으)로 배정했어요!"
        
        return {
            "team": team,
            "role": role,
            "reasoning": reasoning,
        }
    except json.JSONDecodeError:
        return {
            "team": "시민팀",
            "role": "시민",
            "reasoning": "분석 중 오류가 있었지만, 당신은 분명 멋진 시민이에요!",
        }
    except Exception as e:
        logger.error(f"Role assignment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"role_assignment_error: {str(e)}"
        )
