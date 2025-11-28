import logging
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# Load the root .env so both FE/BE share the same secrets locally.
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.supabase_url = os.getenv("REACT_APP_SUPABASE_URL", "")
        self.supabase_key = os.getenv("REACT_APP_SUPABASE_ANON_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.kakao_client_id = os.getenv("KAKAO_CLIENT_ID", "")
        self.kakao_client_secret = os.getenv("KAKAO_CLIENT_SECRET", "")
        self.kakao_redirect_uri = os.getenv("KAKAO_REDIRECT_URI", "")
        self.base_url = os.getenv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000")
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY", "")
        self.pinecone_environment = os.getenv("PINECONE_ENVIRONMENT", "")
        self.pinecone_index = os.getenv("PINECONE_INDEX", "members")
        self.app_secret = os.getenv("APP_SECRET", "dev-secret-change-me")
        self.session_ttl_seconds = int(os.getenv("SESSION_TTL_SECONDS", "604800"))
        self.admin_ids: List[str] = [
            admin.strip()
            for admin in os.getenv("ADMIN_KAKAO_IDS", "").split(",")
            if admin.strip()
        ]
        # Default to the large 3072-dim model described in the README.
        self.embedding_model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")


settings = Settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("farewell-party")
