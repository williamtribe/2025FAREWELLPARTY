import logging
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# Load the root .env so both FE/BE share the same secrets locally.
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("farewell-party")


class Settings:
    def __init__(self) -> None:
        self.supabase_url = os.getenv("REACT_APP_SUPABASE_URL", "").strip()
        self.supabase_service_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY", "")).strip()
        self.supabase_key = self.supabase_service_key or os.getenv("REACT_APP_SUPABASE_ANON_KEY", "").strip()
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.kakao_client_id = os.getenv("KAKAO_CLIENT_ID", "").strip()
        self.kakao_client_secret = os.getenv("KAKAO_CLIENT_SECRET", "").strip()
        self.kakao_redirect_uri = os.getenv("KAKAO_REDIRECT_URI", "").strip()
        self.base_url = os.getenv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000").strip()
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY", "").strip()
        self.pinecone_environment = os.getenv("PINECONE_ENVIRONMENT", "").strip()
        self.pinecone_index = os.getenv("PINECONE_INDEX", "members").strip()
        self.app_secret = os.getenv("APP_SECRET", "dev-secret-change-me").strip()
        self.session_ttl_seconds = int(os.getenv("SESSION_TTL_SECONDS", "604800"))
        self.admin_ids: List[str] = [
            admin.strip()
            for admin in os.getenv("ADMIN_KAKAO_IDS", "").split(",")
            if admin.strip()
        ]
        self.embedding_model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large").strip()

        # Debug Kakao Config (Masked)
        if self.kakao_client_id:
            logger.info("Kakao Config Loaded - ID: %s..., URI: %s", 
                        self.kakao_client_id[:4], self.kakao_redirect_uri)
        else:
            logger.warning("KAKAO_CLIENT_ID is MISSING!")


settings = Settings()
