from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    token: str
    api_base: str
    admin_ids: set[int]
    admin_panel_url: str
    openai_api_key: str | None
    forward_concurrency: int


def load_settings() -> Settings:
    ids = {
        int(item.strip())
        for item in os.getenv("BOT_ADMIN_IDS", "").split(",")
        if item.strip().isdigit()
    }
    return Settings(
        token=os.environ["BOT_TOKEN"],
        api_base=os.getenv("BOT_API_BASE", "http://localhost:4000/api").rstrip("/"),
        admin_ids=ids,
        admin_panel_url=os.getenv("ADMIN_PANEL_URL", "https://frontend-production-89aa6.up.railway.app/admin"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        forward_concurrency=max(1, int(os.getenv("FORWARD_CONCURRENCY", "5"))),
    )
