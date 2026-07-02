from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    token: str
    api_base: str
    admin_ids: set[int]


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
    )
