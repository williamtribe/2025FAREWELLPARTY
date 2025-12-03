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
        result = self.client.table("member_profiles").upsert(data).execute()
        return {"data": result.data}

    def fetch_profile(self, kakao_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        result = self.client.table("member_profiles").select("*").eq(
            "kakao_id", kakao_id).limit(1).execute()
        if not result.data:
            return None
        return result.data[0]

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


session_signer = SessionSigner()
kakao_client = KakaoClient()
supabase_service = SupabaseService()
embedding_service = EmbeddingService()
intro_generation_service = IntroGenerationService()
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
                            profile: Dict[str, Any]) -> Dict[str, Any]:
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
