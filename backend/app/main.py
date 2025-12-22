from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import Annotated, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from .config import logger, settings
from .services import (
    assemble_profile_record,
    clustering_service,
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
api_router = APIRouter(prefix="/api")

FRONTEND_BUILD_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

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
    want_to_talk_to: Optional[str] = None
    profile_image: Optional[str] = None
    visibility: Literal["public", "private", "members"] = "public"


class PreferencePayload(BaseModel):
    answers: Dict[str, str]
    mood: Optional[str] = None


class KakaoMessagePayload(BaseModel):
    access_token: str
    receiver_uuids: List[str]
    text: Optional[str] = None


class KakaoTemplatePayload(BaseModel):
    access_token: str
    receiver_uuids: List[str]
    template_id: int = 126817


async def optional_user(
    authorization: Annotated[Optional[str],
                             Header(alias="Authorization")] = None,
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
    authorization: Annotated[Optional[str],
                             Header(alias="Authorization")] = None,
) -> SessionUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="missing_token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = session_signer.verify(token)
        return SessionUser(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=str(exc)) from exc


@app.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/auth/kakao/login")
async def kakao_login():
    state = secrets.token_urlsafe(16)
    auth_url = await kakao_client.build_login_url(state)
    return {"auth_url": str(auth_url), "state": state}


@api_router.get("/auth/kakao/callback")
async def kakao_callback(code: str, state: Optional[str] = None):
    from fastapi.responses import HTMLResponse
    import json

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="missing_code")
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

    # Check if user exists, create or update profile
    existing_profile = supabase_service.fetch_profile(kakao_id)
    if existing_profile:
        # Update profile_image for existing users on every login
        if profile_image_url:
            supabase_service.update_profile_image(kakao_id, profile_image_url)
    else:
        # Create new profile for first-time users
        new_profile = {
            "kakao_id": kakao_id,
            "name": nickname,
            "tagline": "",
            "intro": "",
            "interests": [],
            "strengths": [],
            "contact": "",
            "visibility": "public",
            "profile_image": profile_image_url,
        }
        supabase_service.upsert_profile(new_profile)

    payload = {
        "kakao_id": kakao_id,
        "nickname": nickname,
        "profile_image_url": profile_image_url,
        "is_admin": kakao_id in settings.admin_ids,
    }
    session_token = session_signer.sign(payload)

    session_data = {
        "session_token": session_token,
        "profile": payload,
        "state": state
    }
    session_json = json.dumps(session_data)

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>로그인 처리 중...</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }}
            .container {{
                text-align: center;
                padding: 2rem;
            }}
            .spinner {{
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="spinner"></div>
            <p>로그인 처리 중...</p>
        </div>
        <script>
            const sessionData = {session_json};
            const sessionPayload = {{
                ...sessionData.profile,
                session_token: sessionData.session_token
            }};
            
            localStorage.setItem("farewell-session", JSON.stringify(sessionPayload));
            localStorage.removeItem("kakao-state");
            localStorage.setItem("farewell-landing-seen", "1");
            
            if (window.opener) {{
                window.opener.postMessage(
                    {{ type: "kakao-login-success", session: sessionPayload }},
                    "*"
                );
                window.close();
            }} else {{
                window.location.href = "/";
            }}
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@api_router.get("/me")
async def get_my_profile(user: SessionUser = Depends(get_current_user)):
    profile = supabase_service.fetch_profile(user.kakao_id)
    return {"profile": profile}


@api_router.put("/me")
async def upsert_profile(payload: ProfilePayload,
                         user: SessionUser = Depends(get_current_user)):
    record = assemble_profile_record(user.kakao_id, payload.model_dump(),
                                     user.profile_image_url)
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
        "profile":
        record,
        "supabase":
        supabase_result.get("data")
        if isinstance(supabase_result, dict) else supabase_result,
        "pinecone":
        pinecone_results if pinecone_results else None,
    }


@api_router.post("/preferences")
async def save_preferences(payload: PreferencePayload,
                           user: SessionUser = Depends(get_current_user)):
    data = {
        "kakao_id": user.kakao_id,
        "answers": payload.answers,
        "mood": payload.mood,
    }
    supabase_result = supabase_service.upsert_preferences(data)
    return {"preferences": data, "supabase": supabase_result}


class IntroGenerationPayload(BaseModel):
    answers: Dict[str, str]


@api_router.post("/generate-intro")
async def generate_intro(payload: IntroGenerationPayload,
                         user: SessionUser = Depends(get_current_user)):
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


@api_router.post("/intro-yesorno")
async def save_yesorno(payload: YesOrNoPayload,
                       user: SessionUser = Depends(get_current_user)):
    if payload.response not in (-1, 1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="response must be -1 or 1")
    result = supabase_service.upsert_yesorno(user.kakao_id,
                                             payload.question_num,
                                             payload.response)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=result["error"])
    return {"saved": True, "result": result}


@api_router.get("/intro-yesorno")
async def get_yesorno(user: SessionUser = Depends(get_current_user)):
    row = supabase_service.fetch_yesorno(user.kakao_id)
    return {"responses": row}


@api_router.post("/generate-intro-from-yesorno")
async def generate_intro_from_yesorno(
        user: SessionUser = Depends(get_current_user)):
    yesorno_data = supabase_service.fetch_yesorno(user.kakao_id)
    if not yesorno_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="yesorno_data_not_found")

    has_responses = any(
        yesorno_data.get(str(i)) in (1, -1) for i in range(1, 6))
    if not has_responses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="no_responses_found")

    result = intro_generation_service.generate_intro_from_yesorno(
        yesorno_data, user.nickname or "친구")
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="intro_generation_failed",
        )
    return result


@api_router.get("/profiles/count")
async def get_profiles_count():
    if not supabase_service.client:
        return {"count": 0}
    try:
        result = supabase_service.client.table("member_profiles").select(
            "kakao_id", count="exact").execute()
        return {"count": result.count or 0}
    except Exception:
        return {"count": 0}


@api_router.get("/profiles/public")
async def list_public_profiles(limit: int = 50):
    profiles = supabase_service.fetch_public_profiles(limit=limit)
    return {"profiles": profiles}


@api_router.get("/profiles/members")
async def list_member_visible_profiles(limit: int = 50, user: SessionUser = Depends(get_current_user)):
    profiles = supabase_service.fetch_member_visible_profiles(limit=limit)
    return {"profiles": profiles}


@api_router.get("/picks")
async def get_my_picks(user: SessionUser = Depends(get_current_user)):
    """Get list of kakao_ids that current user has picked."""
    picks = supabase_service.get_picked_profiles(user.kakao_id)
    return {"picks": picks}


@api_router.post("/picks/{target_kakao_id}")
async def add_pick(target_kakao_id: str, user: SessionUser = Depends(get_current_user)):
    """Add a profile to user's picked list."""
    if target_kakao_id == user.kakao_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_pick_self")
    result = supabase_service.add_pick(user.kakao_id, target_kakao_id)
    if result.get("skipped"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("reason"))
    return {"success": True, "has_picked": result.get("has_picked", [])}


@api_router.delete("/picks/{target_kakao_id}")
async def remove_pick(target_kakao_id: str, user: SessionUser = Depends(get_current_user)):
    """Remove a profile from user's picked list."""
    result = supabase_service.remove_pick(user.kakao_id, target_kakao_id)
    if result.get("skipped"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("reason"))
    return {"success": True, "has_picked": result.get("has_picked", [])}


@api_router.get("/profiles/{kakao_id}")
async def view_profile(
        kakao_id: str,
        user: SessionUser | None = Depends(optional_user),
):
    profile = supabase_service.fetch_profile(kakao_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="not_found")

    is_owner = user and user.kakao_id == kakao_id
    is_admin = user.is_admin if user else False

    if profile.get("visibility") == "private" and not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="forbidden")
    return {"profile": profile}


@api_router.get("/admin/profiles")
async def admin_profiles(user: SessionUser = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    if not supabase_service.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="supabase_not_configured",
        )
    result = supabase_service.client.table("member_profiles").select(
        "*").execute()
    return {"profiles": result.data}


@api_router.post("/admin/reembed-all")
async def reembed_all_profiles(user: SessionUser = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    if not supabase_service.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="supabase_not_configured",
        )

    result = supabase_service.client.table("member_profiles").select(
        "*").execute()
    profiles = result.data or []

    stats = {
        "total": len(profiles),
        "intro_success": 0,
        "interests_success": 0,
        "errors": []
    }

    for profile in profiles:
        kakao_id = profile.get("kakao_id")
        if not kakao_id:
            continue

        metadata = {
            "visibility": profile.get("visibility", "public"),
            "name": profile.get("name", "")
        }

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


@api_router.get("/admin/profiles-order")
async def get_profiles_order(user: SessionUser = Depends(get_current_user)):
    """Get all profiles for admin to manage display order."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    profiles = supabase_service.fetch_all_profiles_for_admin()
    return {"profiles": profiles}


class OrderItem(BaseModel):
    kakao_id: str
    display_order: int


class UpdateOrderPayload(BaseModel):
    orders: list[OrderItem]


@api_router.post("/admin/profiles-order")
async def update_profiles_order(payload: UpdateOrderPayload,
                                user: SessionUser = Depends(get_current_user)):
    """Update display order for profiles (admin only)."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    orders = [{
        "kakao_id": item.kakao_id,
        "display_order": item.display_order
    } for item in payload.orders]
    result = supabase_service.update_display_order(orders)
    if result.get("skipped"):
        if result.get("reason") == "display_order_column_not_exists":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=
                "display_order 컬럼이 없습니다. Supabase에서 추가해주세요: ALTER TABLE member_profiles ADD COLUMN display_order INTEGER DEFAULT 999;"
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=result.get("reason"))
    return {"message": "order_updated", "result": result}


@api_router.post("/admin/embed-jobs")
async def embed_mafia42_jobs(user: SessionUser = Depends(get_current_user)):
    """Embed all mafia42_jobs into Pinecone with namespace 'mafia42_jobs'."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")

    jobs = supabase_service.fetch_mafia42_jobs()
    if not jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="mafia42_jobs 테이블이 비어있거나 접근할 수 없습니다.")

    embedded_count = 0
    failed_jobs = []

    for job in jobs:
        code = str(job.get("code", ""))
        name = job.get("name", "")
        story = job.get("story", "")
        team = job.get("team", "")

        if not story:
            failed_jobs.append({"code": code, "reason": "no_story"})
            continue

        text_to_embed = f"{name}: {story}"

        try:
            vector = embedding_service.embed_member(text_to_embed)

            if not vector:
                failed_jobs.append({
                    "code": code,
                    "reason": "embedding_failed"
                })
                continue

            story_truncated = story[:2000] if len(story) > 2000 else story

            result = pinecone_service.upsert_embedding(
                member_id=code,
                vector=vector,
                metadata={
                    "code": code,
                    "name": name,
                    "team": team,
                    "story": story_truncated
                },
                namespace="mafia42_jobs")

            if result.get("skipped"):
                failed_jobs.append({
                    "code": code,
                    "reason": result.get("reason")
                })
            else:
                embedded_count += 1
        except Exception as e:
            logger.error(f"Error embedding job {code}: {e}")
            failed_jobs.append({"code": code, "reason": str(e)[:100]})

    return {
        "message": "jobs_embedded",
        "total_jobs": len(jobs),
        "embedded_count": embedded_count,
        "failed_jobs": failed_jobs
    }


class FixedRolePayload(BaseModel):
    kakao_id: str
    fixed_role: Optional[str] = None


@api_router.get("/admin/jobs")
async def get_mafia42_jobs():
    """Get all Mafia42 jobs for debugging."""
    jobs = supabase_service.fetch_mafia42_jobs()
    return {"jobs": jobs}


@api_router.get("/admin/fixed-roles")
async def get_fixed_roles(user: SessionUser = Depends(get_current_user)):
    """Get all profiles with their fixed roles for admin management."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    profiles = supabase_service.fetch_all_profiles_with_roles()
    jobs = supabase_service.fetch_mafia42_jobs()
    job_list = [{
        "code": str(j.get("code")),
        "name": j.get("name"),
        "team": j.get("team")
    } for j in jobs]
    return {"profiles": profiles, "jobs": job_list}


@api_router.post("/admin/fixed-roles")
async def set_fixed_role(payload: FixedRolePayload,
                         user: SessionUser = Depends(get_current_user)):
    """Set or clear a fixed role for a user (admin only). Pass fixed_role=null to clear."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    result = supabase_service.update_fixed_role(payload.kakao_id,
                                                payload.fixed_role)
    if result.get("skipped"):
        if result.get("reason") == "fixed_role_column_not_exists":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=
                "fixed_role 컬럼이 없습니다. Supabase에서 추가해주세요: ALTER TABLE member_profiles ADD COLUMN fixed_role TEXT;"
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=result.get("reason"))
    return {
        "message": "fixed_role_updated",
        "kakao_id": payload.kakao_id,
        "fixed_role": payload.fixed_role
    }


class ClusterRequest(BaseModel):
    k: int = Field(default=3, ge=2, le=10)
    namespace: Literal["intro", "interests"] = "intro"


@api_router.post("/admin/clusters")
async def admin_clusters(payload: ClusterRequest,
                         user: SessionUser = Depends(get_current_user)):
    """Cluster profiles using K-means on embeddings (admin only)."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    result = clustering_service.cluster_profiles(k=payload.k, namespace=payload.namespace)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=result.get("error"))
    return result


@api_router.get("/admin/all-roles")
async def admin_all_roles(user: SessionUser = Depends(get_current_user)):
    """Get all member profiles with their Mafia42 roles (admin only)."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    
    profiles = supabase_service.fetch_all_profiles_for_admin()
    jobs = supabase_service.fetch_mafia42_jobs()
    job_map = {str(j.get("code")): j for j in jobs}
    job_name_map = {j.get("name"): j for j in jobs}
    logger.info(f"Loaded {len(jobs)} jobs, job_map keys: {list(job_map.keys())[:5]}")
    
    results = []
    for profile in profiles:
        kakao_id = str(profile.get("kakao_id"))
        name = profile.get("name") or "익명"
        fixed_role = profile.get("fixed_role")
        profile_image = profile.get("profile_image")
        
        role_info = {
            "kakao_id": kakao_id,
            "name": name,
            "profile_image": profile_image,
            "role": None,
            "team": None,
            "code": None,
            "fixed": False,
            "similarity": None,
        }
        
        if fixed_role:
            job_data = job_name_map.get(fixed_role)
            if job_data:
                role_info["role"] = job_data.get("name")
                role_info["team"] = _convert_team_name(job_data.get("team", "citizen"))
                role_info["code"] = str(job_data.get("code", ""))
            else:
                role_info["role"] = fixed_role
                role_info["team"] = "시민팀"
            role_info["fixed"] = True
        else:
            profile_text = f"{name}\n{profile.get('tagline', '')}\n{profile.get('intro', '')}\n{', '.join(profile.get('interests') or [])}\n{', '.join(profile.get('strengths') or [])}"
            user_vector = embedding_service.embed_member(profile_text)
            
            if user_vector:
                matches = pinecone_service.query_by_vector(vector=user_vector, top_k=1, namespace="mafia42_jobs")
                logger.info(f"Role assignment for {name}: vector={bool(user_vector)}, matches={len(matches) if matches else 0}")
                if matches:
                    best = matches[0]
                    job_code = str(best.get("id", ""))
                    logger.info(f"Best match for {name}: job_code={job_code}, score={best.get('score')}")
                    job_data = job_map.get(job_code)
                    if job_data:
                        role_info["role"] = job_data.get("name")
                        role_info["team"] = _convert_team_name(job_data.get("team", "citizen"))
                        role_info["code"] = str(job_data.get("code", ""))
                        role_info["similarity"] = round(best.get("score", 0) * 100, 1)
                    else:
                        logger.warning(f"Job not found in job_map for code: {job_code}, available keys: {list(job_map.keys())[:5]}")
        
        results.append(role_info)
    
    results.sort(key=lambda x: (x["team"] or "zzz", x["role"] or "zzz", x["name"]))
    
    return {"roles": results, "total": len(results)}


class PersonalMessagePayload(BaseModel):
    kakao_id: str
    title: str
    content: str


class UserLetterPayload(BaseModel):
    recipient_kakao_id: str
    title: str
    content: str


@api_router.get("/personal-page/{kakao_id}")
async def get_personal_page(kakao_id: str, user: SessionUser = Depends(get_current_user)):
    """Get personal page - only accessible by the matching kakao_id user."""
    if user.kakao_id != kakao_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="access_denied")
    
    message = supabase_service.fetch_personal_message(kakao_id)
    profile = supabase_service.fetch_profile(kakao_id)
    sent_letters = supabase_service.fetch_sent_letters(kakao_id)
    received_letters = supabase_service.fetch_received_letters(kakao_id)
    
    all_profiles = supabase_service.fetch_all_profiles_for_admin()
    profile_map = {str(p.get("kakao_id")): p for p in all_profiles}
    
    sent_with_names = []
    for letter in sent_letters:
        recipient = profile_map.get(str(letter.get("recipient_kakao_id")), {})
        sent_with_names.append({
            **letter,
            "recipient_name": recipient.get("name", "알 수 없음"),
            "recipient_image": recipient.get("profile_image")
        })
    
    received_with_names = []
    for letter in received_letters:
        sender = profile_map.get(str(letter.get("sender_kakao_id")), {})
        received_with_names.append({
            **letter,
            "sender_name": sender.get("name", "알 수 없음"),
            "sender_image": sender.get("profile_image")
        })
    
    return {
        "has_message": message is not None,
        "title": message.get("title") if message else None,
        "content": message.get("content") if message else None,
        "profile_name": profile.get("name") if profile else None,
        "profile_image": profile.get("profile_image") if profile else None,
        "sent_letters": sent_with_names,
        "received_letters": received_with_names
    }


@api_router.post("/letters")
async def send_letter(payload: UserLetterPayload, user: SessionUser = Depends(get_current_user)):
    """Send a letter to another user."""
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="title_and_content_required")
    
    if user.kakao_id == payload.recipient_kakao_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="cannot_send_to_self")
    
    result = supabase_service.send_user_letter(
        sender_kakao_id=user.kakao_id,
        recipient_kakao_id=payload.recipient_kakao_id,
        title=payload.title,
        content=payload.content
    )
    
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=result.get("error"))
    
    return {"message": "sent", "data": result.get("data")}


@api_router.get("/admin/personal-messages")
async def get_all_personal_messages(user: SessionUser = Depends(get_current_user)):
    """Get all personal messages - admin only."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    
    messages = supabase_service.fetch_all_personal_messages()
    profiles = supabase_service.fetch_all_profiles_for_admin()
    
    profile_map = {str(p.get("kakao_id")): p for p in profiles}
    message_map = {str(m.get("kakao_id")): m for m in messages}
    
    result = []
    for profile in profiles:
        kakao_id = str(profile.get("kakao_id"))
        msg = message_map.get(kakao_id)
        result.append({
            "kakao_id": kakao_id,
            "name": profile.get("name"),
            "profile_image": profile.get("profile_image"),
            "has_message": msg is not None,
            "title": msg.get("title") if msg else None,
            "content": msg.get("content") if msg else None
        })
    
    return {"users": result}


@api_router.post("/admin/personal-messages")
async def upsert_personal_message(payload: PersonalMessagePayload,
                                   user: SessionUser = Depends(get_current_user)):
    """Create or update personal message - admin only."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    
    result = supabase_service.upsert_personal_message(
        kakao_id=payload.kakao_id,
        title=payload.title,
        content=payload.content
    )
    
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=result.get("error"))
    
    return {"message": "saved", "data": result.get("data")}


@api_router.get("/kakao/friends")
async def kakao_friends(access_token: str,
                        user: SessionUser = Depends(get_current_user)):
    try:
        friends = await kakao_client.fetch_friends(access_token)
        return {"friends": friends}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"kakao_friends_error: {exc}") from exc


@api_router.post("/kakao/message")
async def kakao_message(payload: KakaoMessagePayload,
                        user: SessionUser = Depends(get_current_user)):
    if not payload.receiver_uuids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="receiver_uuids_required")
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"kakao_message_error: {exc}") from exc


@api_router.post("/kakao/template-message")
async def kakao_template_message(payload: KakaoTemplatePayload,
                                  user: SessionUser = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="admin_only")
    if not payload.receiver_uuids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="receiver_uuids_required")
    try:
        result = await kakao_client.send_template_message(
            access_token=payload.access_token,
            receiver_uuids=payload.receiver_uuids,
            template_id=payload.template_id,
        )
        return {"sent": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"kakao_template_error: {exc}") from exc


@api_router.get("/similar-profiles")
async def get_similar_profiles(user: SessionUser = Depends(get_current_user),
                               limit: int = 10,
                               criteria: Literal["intro",
                                                 "interests"] = "intro"):
    namespace = criteria
    matches = pinecone_service.query_similar(user.kakao_id,
                                             top_k=limit,
                                             namespace=namespace)
    if not matches:
        return {
            "profiles": [],
            "message": "no_embedding_found",
            "criteria": criteria
        }
    profiles = []
    for match in matches:
        profile = supabase_service.fetch_profile(match["kakao_id"])
        if profile and profile.get("visibility") == "public":
            profiles.append({
                **profile,
                "similarity_score": match["score"],
            })
    return {"profiles": profiles, "criteria": criteria}


@api_router.get("/different-profiles")
async def get_different_profiles(user: SessionUser = Depends(get_current_user),
                                 limit: int = 10,
                                 criteria: Literal["intro",
                                                   "interests"] = "intro"):
    namespace = criteria
    matches = pinecone_service.query_different(user.kakao_id,
                                               top_k=limit,
                                               namespace=namespace)
    if not matches:
        return {
            "profiles": [],
            "message": "no_embedding_found",
            "criteria": criteria
        }
    profiles = []
    for match in matches:
        profile = supabase_service.fetch_profile(match["kakao_id"])
        if profile and profile.get("visibility") == "public":
            profiles.append({
                **profile,
                "similarity_score": match["score"],
            })
    return {"profiles": profiles, "criteria": criteria}


@api_router.get("/search-profiles")
async def search_profiles(
    q: str,
    search_type: Literal["intro", "interests"] = "intro",
    limit: int = 10
):
    """Search profiles by text query using embedding similarity."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="검색어는 2글자 이상 입력해주세요."
        )
    
    query_text = q.strip()
    vector = embedding_service.embed_member(query_text)
    
    if not vector:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="임베딩 생성에 실패했습니다."
        )
    
    namespace = search_type
    matches = pinecone_service.query_by_vector(
        vector=vector,
        top_k=limit,
        namespace=namespace
    )
    
    if not matches:
        return {
            "profiles": [],
            "query": query_text,
            "search_type": search_type,
            "message": "검색 결과가 없습니다."
        }
    
    profiles = []
    for match in matches:
        profile = supabase_service.fetch_profile(match["id"])
        if profile and profile.get("visibility") in ["public", "members"]:
            profiles.append({
                **profile,
                "similarity_score": match["score"],
            })
    
    return {
        "profiles": profiles,
        "query": query_text,
        "search_type": search_type
    }


MAFIA42_ROLES = {
    "마피아팀":
    ["마피아", "스파이", "짐승인간", "마담", "도둑", "마녀", "과학자", "사기꾼", "청부업자", "악인"],
    "시민팀": [
        "경찰", "자경단원", "요원", "의사", "군인", "정치인", "영매", "연인", "건달", "기자", "사립탐정",
        "도굴꾼", "테러리스트", "성직자", "예언자", "판사", "간호사", "마술사", "해커", "심리학자", "용병",
        "공무원", "비밀결사", "파파라치", "최면술사", "점쟁이", "시민"
    ],
    "교주팀": ["교주", "광신도"],
}

TEAM_NAME_MAP = {
    "citizen": "시민팀",
    "mafia": "마피아팀",
    "cult": "교주팀",
    "시민": "시민팀",
    "마피아": "마피아팀",
    "교주": "교주팀",
}


def _convert_team_name(team: str) -> str:
    """Convert English team name to Korean team name."""
    return TEAM_NAME_MAP.get(team, team if "팀" in team else f"{team}팀")


class RoleAssignmentPayload(BaseModel):
    name: str = ""
    tagline: str = ""
    intro: str = ""
    interests: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)


@api_router.post("/role-assignment")
async def assign_mafia_role(payload: RoleAssignmentPayload,
                            user: SessionUser = Depends(get_current_user)):
    from openai import OpenAI

    openai_key = settings.openai_api_key
    if not openai_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="openai_not_configured")

    client = OpenAI(api_key=openai_key)

    profile_text = f"""
이름: {payload.name}
한 줄 소개: {payload.tagline}
자기소개: {payload.intro}
관심사: {', '.join(payload.interests)}
특기: {', '.join(payload.strengths)}
"""

    user_profile = supabase_service.fetch_profile(user.kakao_id)
    fixed_role = user_profile.get("fixed_role") if user_profile else None

    if fixed_role:
        jobs = supabase_service.fetch_mafia42_jobs()
        job_data = next((j for j in jobs if j.get("name") == fixed_role), None)

        if job_data:
            job_name = job_data.get("name", fixed_role)
            job_team = _convert_team_name(job_data.get("team", "citizen"))
            job_story = job_data.get("story", "")
            job_code = str(job_data.get("code", ""))

            system_prompt = f"""당신은 마피아42 게임의 직업 배정 전문가입니다.
사용자의 프로필과 배정된 직업의 스토리를 바탕으로, 왜 이 직업이 어울리는지 재미있고 친근하게 설명해주세요.

배정된 직업: {job_name} ({job_team})
직업 스토리: {job_story}

2-3문장으로 왜 이 직업이 사용자에게 어울리는지 설명하세요.
직업의 스토리와 사용자의 특징을 연결해서 작성하세요.
"""
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": f"사용자 프로필:\n{profile_text}"
                        },
                    ],
                    temperature=0.8,
                    max_tokens=200,
                )
                reasoning = response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"Fixed role reasoning error: {e}")
                reasoning = f"당신에게 특별히 배정된 직업이에요. {job_name}으로서 멋진 활약을 기대해요!"

            return {
                "team": job_team,
                "role": job_name,
                "code": job_code,
                "reasoning": reasoning,
                "similarity_score": 1.0,
                "fixed": True,
            }
        else:
            return {
                "team": "시민팀",
                "role": fixed_role,
                "code": "",
                "reasoning": f"관리자가 특별히 배정한 직업: {fixed_role}",
                "similarity_score": 1.0,
                "fixed": True,
            }

    user_vector = embedding_service.embed_member(profile_text)

    if not user_vector:
        return _fallback_role_assignment()

    matches = pinecone_service.query_by_vector(vector=user_vector,
                                               top_k=3,
                                               namespace="mafia42_jobs")

    if not matches:
        return _fallback_role_assignment()

    best_match = matches[0]
    job_code = best_match.get("id", "")
    job_metadata = best_match.get("metadata", {})

    job_name = job_metadata.get("name", "시민")
    job_team = _convert_team_name(job_metadata.get("team", "citizen"))
    job_story = job_metadata.get("story", "")

    if not job_story:
        job_data = supabase_service.fetch_job_by_code(job_code)
        if job_data:
            job_name = job_data.get("name", job_name)
            job_team = _convert_team_name(job_data.get("team", "citizen"))
            job_story = job_data.get("story", "")

    system_prompt = f"""당신은 마피아42 게임의 직업 배정 전문가입니다.
사용자의 프로필과 배정된 직업의 스토리를 바탕으로, 왜 이 직업이 어울리는지 재미있고 친근하게 설명해주세요.

배정된 직업: {job_name} ({job_team})
직업 스토리: {job_story}

2-3문장으로 왜 이 직업이 사용자에게 어울리는지 설명하세요.
직업의 스토리와 사용자의 특징을 연결해서 작성하세요.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"사용자 프로필:\n{profile_text}"
                },
            ],
            temperature=0.8,
            max_tokens=200,
        )

        reasoning = response.choices[0].message.content.strip()

        return {
            "team": job_team,
            "role": job_name,
            "code": job_code,
            "reasoning": reasoning,
            "similarity_score": best_match.get("score", 0),
        }
    except Exception as e:
        logger.error(f"Role reasoning generation error: {e}")
        return {
            "team": job_team,
            "role": job_name,
            "code": job_code,
            "reasoning": f"당신의 특성이 {job_name}과(와) 잘 어울려요!",
            "similarity_score": best_match.get("score", 0),
        }


def _fallback_role_assignment():
    """Fallback when vector search fails."""
    import random
    fallback_roles = [
        {
            "team": "시민팀",
            "role": "시민",
            "code": "citizen"
        },
        {
            "team": "시민팀",
            "role": "경찰",
            "code": "police"
        },
        {
            "team": "시민팀",
            "role": "의사",
            "code": "doctor"
        },
    ]
    chosen = random.choice(fallback_roles)
    return {
        "team": chosen["team"],
        "role": chosen["role"],
        "code": chosen["code"],
        "reasoning": "직업 매칭 서비스를 준비 중이에요. 일단 멋진 역할을 배정해드렸어요!",
        "similarity_score": 0,
    }


class MafBTIPayload(BaseModel):
    intro: str


@api_router.post("/mafbti")
async def mafbti_role_assignment(payload: MafBTIPayload):
    """Public MafBTI endpoint - no authentication required."""
    from openai import OpenAI

    openai_key = settings.openai_api_key
    if not openai_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="openai_not_configured")

    client = OpenAI(api_key=openai_key)

    profile_text = f"자기소개: {payload.intro}"

    user_vector = embedding_service.embed_member(profile_text)

    if not user_vector:
        return _fallback_role_assignment()

    matches = pinecone_service.query_by_vector(vector=user_vector,
                                               top_k=3,
                                               namespace="mafia42_jobs")

    if not matches:
        return _fallback_role_assignment()

    best_match = matches[0]
    job_code = best_match.get("id", "")
    job_metadata = best_match.get("metadata", {})

    job_name = job_metadata.get("name", "시민")
    job_team = _convert_team_name(job_metadata.get("team", "citizen"))
    job_story = job_metadata.get("story", "")

    if not job_story:
        job_data = supabase_service.fetch_job_by_code(job_code)
        if job_data:
            job_name = job_data.get("name", job_name)
            job_team = _convert_team_name(job_data.get("team", "citizen"))
            job_story = job_data.get("story", "")

    system_prompt = f"""당신은 마피아42 게임의 직업 배정 전문가입니다.
사용자의 자기소개와 배정된 직업의 스토리를 바탕으로, 왜 이 직업이 어울리는지 재미있고 친근하게 설명해주세요.

배정된 직업: {job_name} ({job_team})
직업 스토리: {job_story}

2-3문장으로 왜 이 직업이 사용자에게 어울리는지 설명하세요.
직업의 스토리와 사용자의 특징을 연결해서 작성하세요.
반말로 친근하게 작성하세요.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"사용자 자기소개:\n{payload.intro}"
                },
            ],
            temperature=0.8,
            max_tokens=200,
        )

        reasoning = response.choices[0].message.content.strip()

        return {
            "team": job_team,
            "role": job_name,
            "code": job_code,
            "reasoning": reasoning,
            "similarity_score": best_match.get("score", 0),
        }
    except Exception as e:
        logger.error(f"MafBTI reasoning generation error: {e}")
        return {
            "team": job_team,
            "role": job_name,
            "code": job_code,
            "reasoning": f"당신의 특성이 {job_name}과(와) 잘 어울려!",
            "similarity_score": best_match.get("score", 0),
        }


# Include API router with /api prefix
app.include_router(api_router)

# Bot User-Agent patterns for crawler detection
# Note: Only "kakaotalk-scrap" (the actual scraper bot), NOT "kakaotalk" (in-app browser)
BOT_USER_AGENTS = [
    "kakaotalk-scrap",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "telegrambot",
    "discordbot",
    "whatsapp",
    "googlebot",
    "bingbot",
    "yeti",  # Naver
    "daumoa",  # Daum
]

# Page-specific OG meta data
OG_META_BY_PATH = {
    "/": {
        "title": "Fare,Well 2025 - 전체 참가자",
        "description": "대화상대 정해주는 GOAT 테크놀로지와 함께하는 송년회",
        "image": "/thumbnail_optimized.jpg",
    },
    "/info": {
        "title": "Fare,Well 2025 - 행사 정보",
        "description": "Fare,Well 2025 행사 정보",
        "image": "/thumbnail_optimized.jpg",
    },
    "/mafbti": {
        "title": "MafBTI - 나의 마피아42 직업은?",
        "description": "AI가 분석하는 나만의 마피아42 역할! 지금 테스트해보세요",
        "image": "/thumbnail_optimized.jpg",
    },
    "/intro": {
        "title": "Fare,Well 2025 - 간편등록",
        "description": "카카오로 3초만에 등록",
        "image": "/thumbnail_optimized.jpg",
    },
}


def is_crawler_bot(user_agent: str) -> bool:
    if not user_agent:
        return False
    ua_lower = user_agent.lower()
    return any(bot in ua_lower for bot in BOT_USER_AGENTS)


def generate_og_html(path: str, base_url: str) -> str:
    og_data = OG_META_BY_PATH.get(path, OG_META_BY_PATH["/"])
    full_image_url = f"{base_url.rstrip('/')}{og_data['image']}"
    full_page_url = f"{base_url.rstrip('/')}{path}"

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{og_data['title']}</title>
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{full_page_url}" />
    <meta property="og:title" content="{og_data['title']}" />
    <meta property="og:description" content="{og_data['description']}" />
    <meta property="og:image" content="{full_image_url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{og_data['title']}" />
    <meta name="twitter:description" content="{og_data['description']}" />
    <meta name="twitter:image" content="{full_image_url}" />
</head>
<body>
    <h1>{og_data['title']}</h1>
    <p>{og_data['description']}</p>
    <img src="{full_image_url}" alt="썸네일" />
</body>
</html>"""


# Serve static frontend files in production
if FRONTEND_BUILD_DIR.exists():
    # Mount static assets (js, css, images)
    if (FRONTEND_BUILD_DIR / "assets").exists():
        app.mount("/assets",
                  StaticFiles(directory=FRONTEND_BUILD_DIR / "assets"),
                  name="assets")

    # Serve job_images folder
    job_images_dir = FRONTEND_BUILD_DIR / "job_images"
    if job_images_dir.exists():
        app.mount("/job_images",
                  StaticFiles(directory=job_images_dir),
                  name="job_images")

    # Catch-all route for SPA - serve index.html for any unmatched routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        user_agent = request.headers.get("user-agent", "")
        request_path = f"/{full_path}" if full_path else "/"

        # If crawler bot, return dynamic OG meta HTML
        if is_crawler_bot(user_agent):
            logger.info(
                f"Crawler detected: {user_agent[:50]} for path: {request_path}"
            )
            og_html = generate_og_html(request_path, settings.base_url)
            return HTMLResponse(content=og_html)

        # Check if it's a file request (has extension)
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # For all other routes, return index.html (SPA routing)
        index_path = FRONTEND_BUILD_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Not found")
