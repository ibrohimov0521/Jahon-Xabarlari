import logging
import os
from dataclasses import dataclass
from urllib.parse import urlparse

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


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} butun son bo'lishi kerak") from exc
    return min(maximum, max(minimum, value))


def _http_url(name: str, default: str) -> str:
    value = os.getenv(name, default).strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{name} to'liq http:// yoki https:// URL bo'lishi kerak")
    return value


def load_settings() -> Settings:
    raw_ids = [item.strip() for item in os.getenv("BOT_ADMIN_IDS", "").split(",") if item.strip()]
    ids = {int(item) for item in raw_ids if item.isdigit()}
    for item in raw_ids:
        if not item.isdigit():
            logger.warning("BOT_ADMIN_IDS: '%s' is not a valid admin id, skipping it", item)
    if not ids:
        raise ValueError("BOT_ADMIN_IDS ichida kamida bitta haqiqiy Telegram ID bo'lishi kerak")

    token = os.getenv("BOT_TOKEN", "").strip()
    if not token:
        raise ValueError("BOT_TOKEN sozlanmagan")

    service_secret = os.getenv("BOT_SERVICE_SECRET", "").strip()
    if not service_secret:
        raise ValueError("BOT_SERVICE_SECRET sozlanmagan")
    if len(service_secret) < 24:
        raise ValueError("BOT_SERVICE_SECRET kamida 24 belgidan iborat bo'lishi kerak")

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379").strip()
    if not redis_url.startswith(("redis://", "rediss://")):
        raise ValueError("REDIS_URL redis:// yoki rediss:// bilan boshlanishi kerak")

    return Settings(
        token=token,
        api_base=_http_url("BOT_API_BASE", "http://localhost:4000/api"),
        admin_ids=ids,
        admin_panel_url=_http_url("ADMIN_PANEL_URL", "https://jahonxabarlari.uz/admin"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        forward_concurrency=_bounded_int("FORWARD_CONCURRENCY", 5, 1, 5),
        service_secret=service_secret,
        redis_url=redis_url,
    )
