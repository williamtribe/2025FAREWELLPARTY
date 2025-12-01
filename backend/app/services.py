import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec
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
            return self.serializer.loads(token, max_age=settings.session_ttl_seconds)
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
        url = httpx.URL(f"{self.auth_base}/oauth/authorize").copy_merge_params(params)
        return str(url)

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        data = {
            "grant_type": "authorization_code",
            "client_id": settings.kakao_client_id,
            "client_secret": settings.kakao_client_secret,
            "redirect_uri": settings.kakao_redirect_uri,
            "code": code,
        }
        resp = await self.client.post(f"{self.auth_base}/oauth/token", data=data)
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao token error %s: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        return resp.json()

    async def fetch_user(self, access_token: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self.client.get(f"{self.api_base}/v2/user/me", headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def fetch_friends(self, access_token: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self.client.get(f"{self.api_base}/v1/api/talk/friends", headers=headers)
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao friends error %s: %s", resp.status_code, resp.text)
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
                "link": {"web_url": link_url, "mobile_web_url": link_url},
                "button_title": "열어보기",
            },
        }
        resp = await self.client.post(
            f"{self.api_base}/v1/api/talk/friends/message/send",
            headers=headers,
            json=data,
        )
        if resp.is_client_error or resp.is_server_error:
            logger.error("Kakao message error %s: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        return resp.json()


class SupabaseService:
    def __init__(self) -> None:
        self.client: Optional[Client] = None
        if settings.supabase_url and settings.supabase_key:
            self.client = create_client(settings.supabase_url, settings.supabase_key)
        else:
            logger.warning("Supabase credentials missing; data operations will be skipped.")

    def upsert_profile(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        result = self.client.table("member_profiles").upsert(data).execute()
        return {"data": result.data}

    def fetch_profile(self, kakao_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        result = self.client.table("member_profiles").select("*").eq("kakao_id", kakao_id).limit(1).execute()
        if not result.data:
            return None
        return result.data[0]

    def fetch_public_profiles(self, limit: int = 6) -> list[Dict[str, Any]]:
        if not self.client:
            return []
        result = (
            self.client.table("member_profiles")
            .select("kakao_id,name,tagline,intro,interests,strengths,visibility,updated_at")
            .eq("visibility", "public")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    def upsert_preferences(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        result = self.client.table("member_preferences").upsert(data).execute()
        return {"data": result.data}


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
        resp = self.client.embeddings.create(model=settings.embedding_model, input=text)
        return resp.data[0].embedding


class PineconeService:
    def __init__(self) -> None:
        if not settings.pinecone_api_key:
            logger.warning("Pinecone key missing; vector sync will be skipped.")
            self.client = None
            self.index = None
            return

        self.client = Pinecone(api_key=settings.pinecone_api_key)
        if settings.pinecone_index not in [idx["name"] for idx in self.client.list_indexes()]:
            self.client.create_index(
                name=settings.pinecone_index,
                dimension=3072,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        self.index = self.client.Index(settings.pinecone_index)

    def upsert_embedding(self, member_id: str, vector: List[float], metadata: Dict[str, Any]) -> Dict[str, Any]:
        if not self.index:
            return {"skipped": True, "reason": "pinecone_not_configured"}
        upsert_result = self.index.upsert(
            vectors=[{"id": member_id, "values": vector, "metadata": metadata}]
        )
        # Pinecone client objects may carry locks/handlers; keep response JSON-serializable.
        upserted_count = getattr(upsert_result, "upserted_count", None)
        return {"upserted_count": upserted_count}


session_signer = SessionSigner()
kakao_client = KakaoClient()
supabase_service = SupabaseService()
embedding_service = EmbeddingService()
pinecone_service = PineconeService()


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


def assemble_profile_record(kakao_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "kakao_id": kakao_id,
        "name": profile.get("name"),
        "tagline": profile.get("tagline"),
        "intro": profile.get("intro"),
        "interests": profile.get("interests", []),
        "strengths": profile.get("strengths", []),
        "visibility": profile.get("visibility", "public"),
        "contact": profile.get("contact"),
        "updated_at": now,
    }
