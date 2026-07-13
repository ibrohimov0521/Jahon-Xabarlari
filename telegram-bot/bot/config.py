import logging
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Settings:
    token: str
    api_base: str
    admin_ids: set[int]
    admin_panel_url: str
    openai_api_key: str | None
    forward_concurrency: int
    service_secret: str | None
    redis_url: str


def load_settings() -> Settings:
    raw_ids = [item.strip() for item in os.getenv("BOT_ADMIN_IDS", "").split(",") if item.strip()]
    ids = {int(item) for item in raw_ids if item.isdigit()}
    for item in raw_ids:
        if not item.isdigit():
            logger.warning("BOT_ADMIN_IDS: '%s' is not a valid admin id, skipping it", item)
    return Settings(
        token=os.environ["BOT_TOKEN"],
        api_base=os.getenv("BOT_API_BASE", "http://localhost:4000/api").rstrip("/"),
        admin_ids=ids,
        admin_panel_url=os.getenv("ADMIN_PANEL_URL", "https://frontend-production-89aa6.up.railway.app/admin"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        # Each forward may hold a Telegram media file in memory. Keep the operator setting
        # bounded so a typo cannot start dozens of 20 MB downloads at once.
        forward_concurrency=min(5, max(1, int(os.getenv("FORWARD_CONCURRENCY", "5")))),
        service_secret=os.getenv("BOT_SERVICE_SECRET"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
    )
