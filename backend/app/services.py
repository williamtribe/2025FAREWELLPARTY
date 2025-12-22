import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from supabase import Client, create_client

from .config import settings

logger = logging.getLogger("farewell-party.services")


class SessionSigner:

    def __init__(self) -> None:
        self.serializer = URLSafeTimedSerializer(settings.app_secret)

    def sign(self, payload: Dict[str, Any]) -> str:
        return self.serializer.dumps(payload)

    def verify(self, token: str) -> Dict[str, Any]:
        try:
            return self.serializer.loads(token,
                                         max_age=settings.session_ttl_seconds)
        except SignatureExpired as exc:
            raise ValueError("session_expired") from exc
        except BadSignature as exc:
            raise ValueError("invalid_session") from exc


class KakaoClient:
    auth_base = "https://kauth.kakao.com"
    api_base = "https://kapi.kakao.com"

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(timeout=15)

    async def build_login_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.kakao_client_id,
            "redirect_uri": settings.kakao_redirect_uri,
            "state": state,
        }
        # httpx.URL has immutable params; copy_merge_params builds a new URL with query values.
        url = httpx.URL(f"{self.auth_base}/oauth/authorize").copy_merge_params(
            params)
        return str(url)

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        data = {
            "grant_type": "authorization_code",
            "client_id": settings.kakao_client_id,
            "client_secret": settings.kakao_client_secret,
            "redirect_uri": settings.kakao_redirect_uri,
            "code": code,
        }
        resp = await self.client.post(f"{self.auth_base}/oauth/token",
                                      data=data)
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao token error %s: %s", resp.status_code,
                         resp.text)
        resp.raise_for_status()
        return resp.json()

    async def fetch_user(self, access_token: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self.client.get(f"{self.api_base}/v2/user/me",
                                     headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def fetch_friends(self, access_token: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self.client.get(f"{self.api_base}/v1/api/talk/friends",
                                     headers=headers)
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao friends error %s: %s", resp.status_code,
                         resp.text)
        resp.raise_for_status()
        return resp.json()

    async def send_friend_message(
        self,
        access_token: str,
        receiver_uuids: list[str],
        text: str,
        link_url: str,
    ) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {
            "receiver_uuids": receiver_uuids,
            "template_object": {
                "object_type": "text",
                "text": text,
                "link": {
                    "web_url": link_url,
                    "mobile_web_url": link_url
                },
                "button_title": "열어보기",
            },
        }
        resp = await self.client.post(
            f"{self.api_base}/v1/api/talk/friends/message/send",
            headers=headers,
            json=data,
        )
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao message error %s: %s", resp.status_code,
                         resp.text)
        resp.raise_for_status()
        return resp.json()

    async def send_template_message(
        self,
        access_token: str,
        receiver_uuids: list[str],
        template_id: int,
    ) -> Dict[str, Any]:
        """Send a custom template message to friends."""
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {
            "receiver_uuids": receiver_uuids,
            "template_id": template_id,
        }
        resp = await self.client.post(
            f"{self.api_base}/v1/api/talk/friends/message/send",
            headers=headers,
            data=data,
        )
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao template message error %s: %s", resp.status_code,
                         resp.text)
        resp.raise_for_status()
        return resp.json()


class SupabaseService:

    def __init__(self) -> None:
        self.client: Optional[Client] = None
        if settings.supabase_url and settings.supabase_key:
            self.client = create_client(settings.supabase_url,
                                        settings.supabase_key)
        else:
            logger.warning(
                "Supabase credentials missing; data operations will be skipped."
            )

    def upsert_profile(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        logger.info(f"UPSERT PROFILE: kakao_id={data.get('kakao_id')}, name={data.get('name')}")
        result = self.client.table("member_profiles").upsert(data, on_conflict="kakao_id").execute()
        logger.info(f"UPSERT RESULT: {result.data}")
        return {"data": result.data}

    def fetch_profile(self, kakao_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        result = self.client.table("member_profiles").select("*").eq(
            "kakao_id", kakao_id).limit(1).execute()
        if not result.data:
            return None
        return result.data[0]

    def get_picked_profiles(self, kakao_id: str) -> list[str]:
        """Get list of kakao_ids that user has picked."""
        if not self.client:
            return []
        try:
            result = self.client.table("member_profiles").select("has_picked").eq(
                "kakao_id", kakao_id).limit(1).execute()
            if result.data and result.data[0].get("has_picked"):
                picks = result.data[0]["has_picked"]
                if isinstance(picks, list):
                    return picks
                elif isinstance(picks, str):
                    import json
                    try:
                        parsed = json.loads(picks)
                        return parsed if isinstance(parsed, list) else []
                    except:
                        return []
                return []
            return []
        except Exception as e:
            error_str = str(e).lower()
            if "has_picked" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"has_picked column not found for {kakao_id}")
                return []
            raise

    def add_pick(self, kakao_id: str, target_kakao_id: str) -> Dict[str, Any]:
        """Add a profile to user's picked list."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            current_picks = self.get_picked_profiles(kakao_id)
            if target_kakao_id not in current_picks:
                current_picks.append(target_kakao_id)
            result = self.client.table("member_profiles").update({
                "has_picked": current_picks
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data, "has_picked": current_picks}
        except Exception as e:
            error_str = str(e).lower()
            if "has_picked" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"has_picked column not found, cannot add pick")
                return {"skipped": True, "reason": "has_picked_column_not_exists"}
            raise

    def remove_pick(self, kakao_id: str, target_kakao_id: str) -> Dict[str, Any]:
        """Remove a profile from user's picked list."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            current_picks = self.get_picked_profiles(kakao_id)
            if target_kakao_id in current_picks:
                current_picks.remove(target_kakao_id)
            result = self.client.table("member_profiles").update({
                "has_picked": current_picks
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data, "has_picked": current_picks}
        except Exception as e:
            error_str = str(e).lower()
            if "has_picked" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"has_picked column not found, cannot remove pick")
                return {"skipped": True, "reason": "has_picked_column_not_exists"}
            raise

    def update_profile_image(self, kakao_id: str, profile_image_url: str) -> Dict[str, Any]:
        """Update only the profile_image field for an existing user."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            result = self.client.table("member_profiles").update({
                "profile_image": profile_image_url
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data}
        except Exception as e:
            error_str = str(e).lower()
            if "profile_image" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"profile_image column not found, skipping update for {kakao_id}")
                return {"skipped": True, "reason": "profile_image_column_not_exists"}
            raise

    def fetch_public_profiles(self, limit: int = 50) -> list[Dict[str, Any]]:
        if not self.client:
            return []
        
        def is_column_missing(err: Exception, col_name: str) -> bool:
            err_str = str(err).lower()
            return col_name in err_str and ("not exist" in err_str or "not find" in err_str or "could not find" in err_str or "pgrst204" in err_str)
        
        try:
            result = (self.client.table("member_profiles").select(
                "kakao_id,name,tagline,intro,interests,strengths,visibility,profile_image,display_order,updated_at"
            ).eq("visibility", "public").order("display_order", desc=False).order("updated_at", desc=True).limit(limit).execute())
            return result.data or []
        except Exception as e:
            if is_column_missing(e, "display_order"):
                try:
                    result = (self.client.table("member_profiles").select(
                        "kakao_id,name,tagline,intro,interests,strengths,visibility,profile_image,updated_at"
                    ).eq("visibility", "public").order("updated_at", desc=True).limit(limit).execute())
                    return result.data or []
                except Exception as e2:
                    if is_column_missing(e2, "profile_image"):
                        result = (self.client.table("member_profiles").select(
                            "kakao_id,name,tagline,intro,interests,strengths,visibility,updated_at"
                        ).eq("visibility", "public").order("updated_at", desc=True).limit(limit).execute())
                        return result.data or []
                    raise
            elif is_column_missing(e, "profile_image"):
                result = (self.client.table("member_profiles").select(
                    "kakao_id,name,tagline,intro,interests,strengths,visibility,updated_at"
                ).eq("visibility", "public").order("updated_at", desc=True).limit(limit).execute())
                return result.data or []
            raise

    def fetch_member_visible_profiles(self, limit: int = 50) -> list[Dict[str, Any]]:
        """Fetch profiles visible to logged-in members (public + members visibility)."""
        if not self.client:
            return []
        
        def is_column_missing(err: Exception, col_name: str) -> bool:
            err_str = str(err).lower()
            return col_name in err_str and ("not exist" in err_str or "not find" in err_str or "could not find" in err_str or "pgrst204" in err_str)
        
        try:
            result = (self.client.table("member_profiles").select(
                "kakao_id,name,tagline,intro,interests,strengths,contact,want_to_talk_to,visibility,profile_image,display_order,updated_at"
            ).in_("visibility", ["public", "members"]).order("display_order", desc=False).order("updated_at", desc=True).limit(limit).execute())
            return result.data or []
        except Exception as e:
            if is_column_missing(e, "display_order"):
                try:
                    result = (self.client.table("member_profiles").select(
                        "kakao_id,name,tagline,intro,interests,strengths,contact,want_to_talk_to,visibility,profile_image,updated_at"
                    ).in_("visibility", ["public", "members"]).order("updated_at", desc=True).limit(limit).execute())
                    return result.data or []
                except Exception as e2:
                    if is_column_missing(e2, "want_to_talk_to"):
                        result = (self.client.table("member_profiles").select(
                            "kakao_id,name,tagline,intro,interests,strengths,contact,visibility,profile_image,updated_at"
                        ).in_("visibility", ["public", "members"]).order("updated_at", desc=True).limit(limit).execute())
                        return result.data or []
                    raise
            elif is_column_missing(e, "want_to_talk_to"):
                result = (self.client.table("member_profiles").select(
                    "kakao_id,name,tagline,intro,interests,strengths,contact,visibility,profile_image,display_order,updated_at"
                ).in_("visibility", ["public", "members"]).order("display_order", desc=False).order("updated_at", desc=True).limit(limit).execute())
                return result.data or []
            raise

    def fetch_all_profiles_for_admin(self) -> list[Dict[str, Any]]:
        """Fetch all profiles for admin ordering (includes private)."""
        if not self.client:
            return []
        try:
            result = (self.client.table("member_profiles").select(
                "kakao_id,name,tagline,visibility,display_order,updated_at"
            ).order("display_order", desc=False).order("updated_at", desc=True).execute())
            return result.data or []
        except Exception as e:
            error_str = str(e).lower()
            if "display_order" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                result = (self.client.table("member_profiles").select(
                    "kakao_id,name,tagline,visibility,updated_at"
                ).order("updated_at", desc=True).execute())
                return result.data or []
            raise

    def update_display_order(self, orders: list[Dict[str, Any]]) -> Dict[str, Any]:
        """Update display_order for multiple profiles. orders = [{"kakao_id": "...", "display_order": 1}, ...]"""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            results = []
            for item in orders:
                result = self.client.table("member_profiles").update({
                    "display_order": item["display_order"]
                }).eq("kakao_id", item["kakao_id"]).execute()
                results.append(result.data)
            return {"data": results, "updated": len(results)}
        except Exception as e:
            error_str = str(e).lower()
            if "display_order" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning("display_order column not found, skipping order update")
                return {"skipped": True, "reason": "display_order_column_not_exists"}
            raise

    def update_fixed_role(self, kakao_id: str, fixed_role: Optional[str]) -> Dict[str, Any]:
        """Set or clear a fixed role for a user. fixed_role=None to clear."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            result = self.client.table("member_profiles").update({
                "fixed_role": fixed_role
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data, "updated": True}
        except Exception as e:
            error_str = str(e).lower()
            if "fixed_role" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning("fixed_role column not found")
                return {"skipped": True, "reason": "fixed_role_column_not_exists"}
            raise

    def fetch_all_profiles_with_roles(self) -> list[Dict[str, Any]]:
        """Fetch all profiles with fixed_role info for admin."""
        if not self.client:
            return []
        try:
            result = self.client.table("member_profiles").select(
                "kakao_id,name,tagline,visibility,fixed_role"
            ).order("name", desc=False).execute()
            return result.data or []
        except Exception as e:
            error_str = str(e).lower()
            if "fixed_role" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                result = self.client.table("member_profiles").select(
                    "kakao_id,name,tagline,visibility"
                ).order("name", desc=False).execute()
                return [{"fixed_role": None, **p} for p in (result.data or [])]
            raise

    def upsert_preferences(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        result = self.client.table("member_preferences").upsert(data).execute()
        return {"data": result.data}

    def upsert_yesorno(self, kakao_id: str, question_num: int,
                       response: int) -> Dict[str, Any]:
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        if question_num < 1 or question_num > 5:
            return {"error": "question_num must be 1-5"}
        existing = self.client.table("intro_yesorno").select("*").eq(
            "kakao_id", kakao_id).limit(1).execute()
        if existing.data:
            result = self.client.table("intro_yesorno").update({
                str(question_num):
                response
            }).eq("kakao_id", kakao_id).execute()
        else:
            data = {"kakao_id": kakao_id, str(question_num): response}
            result = self.client.table("intro_yesorno").insert(data).execute()
        return {"data": result.data}

    def fetch_yesorno(self, kakao_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        result = self.client.table("intro_yesorno").select("*").eq(
            "kakao_id", kakao_id).limit(1).execute()
        if not result.data:
            return None
        return result.data[0]

    def fetch_mafia42_jobs(self) -> list[Dict[str, Any]]:
        """Fetch all jobs from mafia42_jobs table."""
        if not self.client:
            return []
        try:
            result = self.client.table("mafia42_jobs").select("*").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching mafia42_jobs: {e}")
            return []

    def fetch_job_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Fetch a single job by its code."""
        if not self.client:
            return None
        try:
            result = self.client.table("mafia42_jobs").select("*").eq("code", code).limit(1).execute()
            if not result.data:
                return None
            return result.data[0]
        except Exception as e:
            logger.error(f"Error fetching job by code {code}: {e}")
            return None

    def fetch_personal_message(self, kakao_id: str) -> Optional[Dict[str, Any]]:
        """Fetch personal message for a specific kakao_id."""
        if not self.client:
            return None
        try:
            result = self.client.table("personal_messages").select("*").eq(
                "kakao_id", kakao_id).limit(1).execute()
            if not result.data:
                return None
            return result.data[0]
        except Exception as e:
            logger.error(f"Error fetching personal message for {kakao_id}: {e}")
            return None

    def upsert_personal_message(self, kakao_id: str, title: str, content: str) -> Dict[str, Any]:
        """Create or update personal message for a user."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            result = self.client.table("personal_messages").upsert({
                "kakao_id": kakao_id,
                "title": title,
                "content": content,
                "updated_at": "now()"
            }, on_conflict="kakao_id").execute()
            return {"data": result.data}
        except Exception as e:
            logger.error(f"Error upserting personal message for {kakao_id}: {e}")
            return {"error": str(e)}

    def fetch_all_personal_messages(self) -> list[Dict[str, Any]]:
        """Fetch all personal messages for admin view."""
        if not self.client:
            return []
        try:
            result = self.client.table("personal_messages").select("*").order("updated_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching all personal messages: {e}")
            return []


class EmbeddingService:

    def __init__(self) -> None:
        if not settings.openai_api_key:
            logger.warning("OpenAI key missing; embeddings will be skipped.")
            self.client = None
        else:
            self.client = OpenAI(api_key=settings.openai_api_key)

    def embed_member(self, text: str) -> Optional[List[float]]:
        if not self.client:
            return None
        resp = self.client.embeddings.create(model=settings.embedding_model,
                                             input=text)
        return resp.data[0].embedding


CARDS = [
    {
        "num": 1,
        "question": "나는",
        "leftLabel": "E다.",
        "rightLabel": "I다."
    },
    {
        "num": 2,
        "question": "나는",
        "leftLabel": "T다.",
        "rightLabel": "F다."
    },
    {
        "num": 3,
        "question": "나는 여기 뭐하러 가는가",
        "leftLabel": "스테이크 못참지",
        "rightLabel": "사람 만나러 가죠"
    },
    {
        "num": 4,
        "question": "나는 애니를",
        "leftLabel": "본다",
        "rightLabel": "안본다"
    },
    {
        "num": 5,
        "question": "나는 이 사람을",
        "leftLabel": "ㅉㅉ",
        "rightLabel": "숭배한다"
    },
]

YESORNO_MAPPINGS = {
    1: {
        1: "I다 (내향적)",
        -1: "E다 (외향적)",
    },
    2: {
        1: "F다 (감정적)",
        -1: "T다 (논리적)",
    },
    3: {
        1: "사람 만나러 간다",
        -1: "스테이크 못참는다",
    },
    4: {
        1: "애니를 안본다",
        -1: "애니를 본다",
    },
    5: {
        1: "이 사람을 숭배한다",
        -1: "이 사람이 바보라고 생각한다",
    },
}


class IntroGenerationService:

    def __init__(self) -> None:
        if not settings.openai_api_key:
            logger.warning(
                "OpenAI key missing; intro generation will be skipped.")
            self.client = None
        else:
            self.client = OpenAI(api_key=settings.openai_api_key)

    def generate_intro_from_yesorno(self, yesorno_data: Dict[str, Any],
                                    nickname: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        traits = []
        for q_num in range(1, 6):
            raw_response = yesorno_data.get(str(q_num))
            try:
                response = int(
                    raw_response) if raw_response is not None else None
            except (ValueError, TypeError):
                response = None
            if response in (1, -1):
                trait = YESORNO_MAPPINGS.get(q_num, {}).get(response, "")
                if trait:
                    traits.append(trait)

        if not traits:
            return None

        traits_text = ", ".join(traits)

        prompt = f"""다음 성향을 가진 '{nickname}'님의 재미있는 자기소개를 만들어주세요.

성향: {traits_text}

다음 JSON 형식으로 응답해주세요:
{{
    "tagline": "한 줄로 나를 소개하는 문장 (20자 이내, 유머러스하게)",
    "intro": "2-3문장의 자세한 자기소개 (친근하고 재미있게, 100자 이내)",
    "interests": ["관심사1", "관심사2", "관심사3"],
    "strengths": ["강점1", "강점2"]
}}

주의사항:
- 반드시 JSON 형식만 출력하세요
- 한국어로 작성하세요
- 유머러스하고 친근한 톤으로 작성하세요
- 송년회 분위기에 맞게 밝고 긍정적으로 작성하세요
- 위에 언급된 성향들을 자연스럽게 녹여주세요"""

        try:
            resp = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role":
                    "system",
                    "content":
                    "당신은 재미있는 자기소개를 만들어주는 전문가입니다. JSON 형식으로만 응답하세요."
                }, {
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.8,
                max_tokens=500,
            )
            content = resp.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            import json
            raw_result = json.loads(content)
            validated_result = {
                "tagline":
                str(raw_result.get("tagline", ""))[:50]
                if raw_result.get("tagline") else "",
                "intro":
                str(raw_result.get("intro", ""))[:200]
                if raw_result.get("intro") else "",
                "interests": [],
                "strengths": [],
            }
            raw_interests = raw_result.get("interests", [])
            if isinstance(raw_interests, list):
                validated_result["interests"] = [
                    str(i)[:20] for i in raw_interests[:5] if i
                ]
            elif isinstance(raw_interests, str):
                validated_result["interests"] = [raw_interests[:20]]
            raw_strengths = raw_result.get("strengths", [])
            if isinstance(raw_strengths, list):
                validated_result["strengths"] = [
                    str(s)[:20] for s in raw_strengths[:5] if s
                ]
            elif isinstance(raw_strengths, str):
                validated_result["strengths"] = [raw_strengths[:20]]
            return validated_result
        except Exception as e:
            logger.error(f"Intro generation from yesorno failed: {e}")
            return None

    def generate_intro(self, answers: Dict[str,
                                           Any]) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        answer_lines = []
        for i, card in enumerate(CARDS):
            q_num = i + 1
            raw_response = answers.get(str(q_num))
            try:
                response = int(
                    raw_response) if raw_response is not None else None
            except (ValueError, TypeError):
                response = None
            if response in (1, -1):
                answer_text = YESORNO_MAPPINGS.get(q_num,
                                                   {}).get(response, '미입력')
            else:
                answer_text = '미입력'
            answer_lines.append(f"{card['question']}: {answer_text}")

        answers_text = "\n".join(answer_lines)

        prompt = f"""다음 정보를 바탕으로 재미있고 친근한 자기소개를 만들어주세요.

사용자 답변:
{answers_text}

다음 JSON 형식으로 응답해주세요:
{{
    "tagline": "한 줄로 나를 소개하는 문장 (20자 이내, 유머러스하게)",
    "intro": "2-3문장의 자세한 자기소개 (친근하고 재미있게, 100자 이내)",
    "interests": ["관심사1", "관심사2", "관심사3"],
    "strengths": ["강점1", "강점2"]
}}

주의사항:
- 반드시 JSON 형식만 출력하세요
- 한국어로 작성하세요
- 유머러스하고 친근한 톤으로 작성하세요
- 송년회 분위기에 맞게 밝고 긍정적으로 작성하세요"""

        try:
            resp = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role":
                    "system",
                    "content":
                    "당신은 재미있는 자기소개를 만들어주는 전문가입니다. JSON 형식으로만 응답하세요."
                }, {
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.8,
                max_tokens=500,
            )
            content = resp.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            import json
            raw_result = json.loads(content)
            validated_result = {
                "tagline":
                str(raw_result.get("tagline", ""))[:50]
                if raw_result.get("tagline") else "",
                "intro":
                str(raw_result.get("intro", ""))[:200]
                if raw_result.get("intro") else "",
                "interests": [],
                "strengths": [],
            }
            raw_interests = raw_result.get("interests", [])
            if isinstance(raw_interests, list):
                validated_result["interests"] = [
                    str(i)[:20] for i in raw_interests[:5] if i
                ]
            elif isinstance(raw_interests, str):
                validated_result["interests"] = [raw_interests[:20]]
            raw_strengths = raw_result.get("strengths", [])
            if isinstance(raw_strengths, list):
                validated_result["strengths"] = [
                    str(s)[:20] for s in raw_strengths[:5] if s
                ]
            elif isinstance(raw_strengths, str):
                validated_result["strengths"] = [raw_strengths[:20]]
            return validated_result
        except Exception as e:
            logger.error(f"Intro generation failed: {e}")
            return None


class PineconeService:

    def __init__(self) -> None:
        if not settings.pinecone_api_key:
            logger.warning(
                "Pinecone key missing; vector sync will be skipped.")
            self.client = None
            self.index = None
            return

        self.client = Pinecone(api_key=settings.pinecone_api_key)
        if settings.pinecone_index not in [
                idx["name"] for idx in self.client.list_indexes()
        ]:
            self.client.create_index(
                name=settings.pinecone_index,
                dimension=3072,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        self.index = self.client.Index(settings.pinecone_index)

    def upsert_embedding(self, member_id: str, vector: List[float],
                         metadata: Dict[str, Any], namespace: str = "") -> Dict[str, Any]:
        if not self.index:
            return {"skipped": True, "reason": "pinecone_not_configured"}
        try:
            upsert_result = self.index.upsert(
                vectors=[{
                    "id": member_id,
                    "values": vector,
                    "metadata": metadata
                }],
                namespace=namespace
            )
            upserted_count = getattr(upsert_result, "upserted_count", None)
            return {"upserted_count": upserted_count, "namespace": namespace}
        except Exception as e:
            logger.error(f"Pinecone upsert error for {member_id}: {e}")
            return {"skipped": True, "reason": f"upsert_error: {str(e)[:100]}"}

    def fetch_vector(self, member_id: str, namespace: str = "") -> Optional[List[float]]:
        if not self.index:
            return None
        try:
            result = self.index.fetch(ids=[member_id], namespace=namespace)
            vectors = result.get("vectors", {})
            if member_id in vectors:
                return vectors[member_id].get("values")
            return None
        except Exception as e:
            logger.error(f"Pinecone fetch error: {e}")
            return None

    def query_similar(self, member_id: str, top_k: int = 10, 
                      exclude_self: bool = True, namespace: str = "") -> List[Dict[str, Any]]:
        if not self.index:
            return []
        vector = self.fetch_vector(member_id, namespace=namespace)
        if not vector:
            return []
        try:
            result = self.index.query(
                vector=vector,
                top_k=top_k + (1 if exclude_self else 0),
                include_metadata=True,
                namespace=namespace,
            )
            matches = []
            for match in result.get("matches", []):
                if exclude_self and match["id"] == member_id:
                    continue
                matches.append({
                    "kakao_id": match["id"],
                    "score": match["score"],
                    "metadata": match.get("metadata", {}),
                })
            return matches[:top_k]
        except Exception as e:
            logger.error(f"Pinecone query error: {e}")
            return []

    def query_different(self, member_id: str, top_k: int = 10,
                        exclude_self: bool = True, namespace: str = "") -> List[Dict[str, Any]]:
        if not self.index:
            return []
        similar = self.query_similar(member_id, top_k=100, exclude_self=exclude_self, namespace=namespace)
        if not similar:
            return []
        different = sorted(similar, key=lambda x: x["score"])
        return different[:top_k]

    def query_by_vector(self, vector: List[float], top_k: int = 5, 
                        namespace: str = "") -> List[Dict[str, Any]]:
        """Query Pinecone directly with a vector (not by member_id)."""
        if not self.index:
            return []
        try:
            result = self.index.query(
                vector=vector,
                top_k=top_k,
                include_metadata=True,
                namespace=namespace,
            )
            matches = []
            for match in result.get("matches", []):
                matches.append({
                    "id": match["id"],
                    "score": match["score"],
                    "metadata": match.get("metadata", {}),
                })
            return matches
        except Exception as e:
            logger.error(f"Pinecone query_by_vector error: {e}")
            return []


class ClusteringService:
    """Clustering service using K-means on Pinecone embeddings."""

    def __init__(self, pinecone_svc: PineconeService, supabase_svc: SupabaseService) -> None:
        self.pinecone = pinecone_svc
        self.supabase = supabase_svc

    def _balanced_assignment(self, X: np.ndarray, centroids: np.ndarray, k: int, tolerance: float = 0.2) -> np.ndarray:
        """
        Assign points to clusters with soft-balanced sizes.
        Allows ±tolerance variation from target size for more natural clustering.
        """
        n = len(X)
        target_size = n // k
        remainder = n % k
        
        flex = max(1, int(target_size * tolerance))
        max_sizes = [target_size + flex + (1 if i < remainder else 0) for i in range(k)]
        min_sizes = [max(1, target_size - flex) for _ in range(k)]
        
        distances = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
        
        labels = np.full(n, -1, dtype=int)
        cluster_counts = [0] * k
        
        for point_idx in range(n):
            nearest = int(np.argmin(distances[point_idx]))
            if cluster_counts[nearest] < max_sizes[nearest]:
                labels[point_idx] = nearest
                cluster_counts[nearest] += 1
            else:
                cluster_order = np.argsort(distances[point_idx])
                for cluster_idx in cluster_order:
                    if cluster_counts[cluster_idx] < max_sizes[cluster_idx]:
                        labels[point_idx] = cluster_idx
                        cluster_counts[cluster_idx] += 1
                        break
        
        return labels

    def cluster_profiles(self, k: int = 3, namespace: str = "intro") -> Dict[str, Any]:
        """
        Cluster member profiles using K-means on their embeddings.
        
        Args:
            k: Number of clusters (2-10)
            namespace: Pinecone namespace to use ('intro' or 'interests')
        
        Returns:
            Dict with clusters info and graph data for visualization
        """
        if not self.pinecone.index:
            return {"error": "Pinecone not configured"}
        
        k = max(2, min(k, 10))
        
        profiles = self.supabase.fetch_all_profiles_for_admin()
        if not profiles:
            return {"error": "No profiles found"}
        
        embeddings = []
        valid_profiles = []
        
        for profile in profiles:
            kakao_id = str(profile.get("kakao_id"))
            vector = self.pinecone.fetch_vector(kakao_id, namespace=namespace)
            if vector:
                embeddings.append(vector)
                valid_profiles.append(profile)
        
        if len(valid_profiles) < k:
            return {
                "error": f"Not enough profiles with embeddings. Found {len(valid_profiles)}, need at least {k}",
                "profiles_with_embeddings": len(valid_profiles)
            }
        
        X = np.array(embeddings)
        
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(X)
        centroids = kmeans.cluster_centers_
        
        labels = self._balanced_assignment(X, centroids, k)
        
        pca = PCA(n_components=2)
        coords_2d = pca.fit_transform(X)
        
        if len(coords_2d) > 0:
            for dim in range(2):
                col = coords_2d[:, dim]
                min_val, max_val = col.min(), col.max()
                if max_val - min_val > 0:
                    coords_2d[:, dim] = (col - min_val) / (max_val - min_val) * 400 - 200
                else:
                    coords_2d[:, dim] = 0
        
        cluster_colors = [
            "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
            "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b"
        ]
        
        nodes = []
        for i, profile in enumerate(valid_profiles):
            cluster_idx = int(labels[i])
            nodes.append({
                "id": str(profile.get("kakao_id")),
                "kakao_id": str(profile.get("kakao_id")),
                "name": profile.get("name") or "익명",
                "cluster": cluster_idx,
                "color": cluster_colors[cluster_idx % len(cluster_colors)],
                "x": float(coords_2d[i][0]),
                "y": float(coords_2d[i][1]),
            })
        
        edges = []
        for cluster_idx in range(k):
            cluster_members = [n for n in nodes if n["cluster"] == cluster_idx]
            for i, member in enumerate(cluster_members):
                for other in cluster_members[i+1:]:
                    edges.append({
                        "source": member["id"],
                        "target": other["id"],
                        "cluster": cluster_idx,
                    })
        
        clusters = []
        for cluster_idx in range(k):
            cluster_members = [n for n in nodes if n["cluster"] == cluster_idx]
            clusters.append({
                "id": cluster_idx,
                "color": cluster_colors[cluster_idx % len(cluster_colors)],
                "member_count": len(cluster_members),
                "members": [{"kakao_id": m["kakao_id"], "name": m["name"]} for m in cluster_members],
            })
        
        return {
            "k": k,
            "namespace": namespace,
            "total_profiles": len(valid_profiles),
            "clusters": clusters,
            "graph": {
                "nodes": nodes,
                "edges": edges,
            }
        }


session_signer = SessionSigner()
kakao_client = KakaoClient()
supabase_service = SupabaseService()
embedding_service = EmbeddingService()
intro_generation_service = IntroGenerationService()
pinecone_service = PineconeService()
clustering_service = ClusteringService(pinecone_service, supabase_service)


def normalize_profile_text(payload: Dict[str, Any]) -> str:
    parts = [
        payload.get("name", ""),
        payload.get("tagline", ""),
        payload.get("intro", ""),
        ", ".join(payload.get("interests") or []),
        ", ".join(payload.get("strengths") or []),
        payload.get("contact", ""),
    ]
    return "\n".join([p for p in parts if p])


def normalize_intro_text(payload: Dict[str, Any]) -> str:
    """Extract intro-focused text for embedding."""
    parts = [
        payload.get("name", ""),
        payload.get("tagline", ""),
        payload.get("intro", ""),
    ]
    return "\n".join([p for p in parts if p])


def normalize_interests_text(payload: Dict[str, Any]) -> str:
    """Extract interests-focused text for embedding."""
    interests = payload.get("interests") or []
    strengths = payload.get("strengths") or []
    parts = [
        payload.get("name", ""),
        "관심사: " + ", ".join(interests) if interests else "",
        "강점: " + ", ".join(strengths) if strengths else "",
    ]
    return "\n".join([p for p in parts if p])


def assemble_profile_record(kakao_id: str,
                            profile: Dict[str, Any],
                            profile_image_url: Optional[str] = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "kakao_id": kakao_id,
        "name": profile.get("name"),
        "tagline": profile.get("tagline"),
        "intro": profile.get("intro"),
        "interests": profile.get("interests", []),
        "strengths": profile.get("strengths", []),
        "visibility": profile.get("visibility", "public"),
        "contact": profile.get("contact"),
        "want_to_talk_to": profile.get("want_to_talk_to"),
        "updated_at": now,
    }
    # Include profile_image if provided (from payload or session)
    img = profile.get("profile_image") or profile_image_url
    if img:
        record["profile_image"] = img
    return record
