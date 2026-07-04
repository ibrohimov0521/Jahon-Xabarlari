from __future__ import annotations

import json
import re
from typing import Any

import aiohttp


MODEL = "claude-haiku-4-5-20251001"

VISIBILITY_KEYS = [
    "showOnHome",
    "showInSlider",
    "showInSidebar",
    "showInLatest",
    "showInPopular",
    "isBreaking",
    "isFeatured",
    "isEditorChoice",
]

KEYWORDS = {
    "sport": ["sport", "futbol", "chempionat", "jahon chempionati", "gol", "klub", "real", "chelsea", "bokschi"],
    "iqtisodiyot": ["iqtisod", "bank", "narx", "dollar", "bozor", "savdo", "sanksiya", "stavka", "neft", "oltin"],
    "siyosat": ["prezident", "vazir", "saylov", "parlament", "siyosat", "tramp", "bmt", "hukumat"],
    "texnologiya": ["texnologiya", "ai", "sun'iy intellekt", "google", "openai", "iphone", "robot", "gemini"],
    "madaniyat": ["madaniyat", "kino", "san'at", "musiqa", "festival", "teatr"],
    "o'zbekiston": ["o'zbekiston", "toshkent", "samarqand", "buxoro", "andijon", "namangan", "farg'ona"],
    "dunyo": ["dunyo", "yevropa", "aqsh", "xitoy", "rossiya", "isroil", "ukraina", "ispaniya", "portugaliya", "saudiya", "marokash"],
}


def _slug(text: str) -> str:
    text = text.lower().replace("ʻ", "'").replace("’", "'")
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _category_by_slug(categories: list[dict[str, Any]], slug: str) -> dict[str, Any] | None:
    normalized = _slug(slug)
    for category in categories:
        if _slug(category.get("slug", "")) == normalized or _slug(category.get("name", "")) == normalized:
            return category
    return None


def fallback_classification(text: str, categories: list[dict[str, Any]]) -> dict[str, Any]:
    normalized = _slug(text)
    scores: dict[str, int] = {}
    for slug, words in KEYWORDS.items():
        scores[slug] = sum(1 for word in words if word in normalized)

    ranked = [slug for slug, score in sorted(scores.items(), key=lambda item: item[1], reverse=True) if score > 0]
    if any(phrase in normalized for phrase in ["jahon chempionati", "futbol", "chempionlar ligasi", "olimpiada"]):
        ranked = ["sport", *[slug for slug in ranked if slug != "sport"]]
    primary = next((_category_by_slug(categories, slug) for slug in ranked if _category_by_slug(categories, slug)), None)
    if not primary:
        primary = _category_by_slug(categories, "dunyo") or categories[0]

    extra_ids = []
    for slug in ranked:
        category = _category_by_slug(categories, slug)
        if category and category["id"] != primary["id"] and category["id"] not in extra_ids:
            extra_ids.append(category["id"])

    is_breaking = any(word in normalized for word in ["tezkor", "breaking", "favqulodda", "rasman", "e'lon qilindi"])
    is_featured = any(word in normalized for word in ["jahon", "prezident", "chempionat", "muhim", "yirik"])
    return {
        "categoryId": primary["id"],
        "extraCategoryIds": extra_ids[:3],
        "showOnHome": True,
        "showInSlider": is_featured,
        "showInSidebar": False,
        "showInLatest": True,
        "showInPopular": False,
        "isBreaking": is_breaking,
        "isFeatured": is_featured,
        "isEditorChoice": False,
        "source": "fallback",
    }


def _sanitize(parsed: dict[str, Any], categories: list[dict[str, Any]], fallback: dict[str, Any]) -> dict[str, Any]:
    category = _category_by_slug(categories, str(parsed.get("primaryCategory", "")))
    if not category:
        category = next((item for item in categories if item["id"] == parsed.get("categoryId")), None)
    result = {**fallback, "source": "ai"}
    if category:
        result["categoryId"] = category["id"]

    extra_ids: list[str] = []
    for item in parsed.get("extraCategories", []) or []:
        extra = _category_by_slug(categories, str(item))
        if extra and extra["id"] != result["categoryId"] and extra["id"] not in extra_ids:
            extra_ids.append(extra["id"])
    result["extraCategoryIds"] = extra_ids[:3] or fallback.get("extraCategoryIds", [])

    for key in VISIBILITY_KEYS:
        if isinstance(parsed.get(key), bool):
            result[key] = parsed[key]
    result["showOnHome"] = bool(result.get("showOnHome", True))
    result["showInLatest"] = bool(result.get("showInLatest", True))
    return result


async def classify_article(text: str, categories: list[dict[str, Any]], api_key: str | None) -> dict[str, Any]:
    fallback = fallback_classification(text, categories)
    if not api_key or not categories:
        return fallback

    category_names = [item["name"] for item in categories]
    prompt = {
        "article": text[:5000],
        "availableCategories": category_names,
        "rules": [
            "Choose exactly one primaryCategory from availableCategories.",
            "extraCategories may contain up to 3 additional categories from availableCategories.",
            "showOnHome and showInLatest should usually be true for normal news.",
            "showInSlider only for very important visual/top news.",
            "isBreaking only for urgent/breaking news.",
            "isFeatured/editorChoice only for high-value editorial items.",
        ],
    }

    try:
        async with aiohttp.ClientSession(
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
        ) as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": MODEL,
                    "max_tokens": 1000,
                    "system": (
                        "You classify Uzbek news articles for a news CMS. "
                        "Respond ONLY with strict JSON: "
                        '{"primaryCategory": string, "extraCategories": string[], '
                        '"showOnHome": boolean, "showInSlider": boolean, "showInSidebar": boolean, '
                        '"showInLatest": boolean, "showInPopular": boolean, "isBreaking": boolean, '
                        '"isFeatured": boolean, "isEditorChoice": boolean}.'
                    ),
                    "messages": [{"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}],
                },
                timeout=20,
            ) as response:
                data = await response.json()
                if response.status >= 400:
                    return fallback
                text_block = next((item for item in data.get("content", []) if item.get("type") == "text"), None)
                if not text_block:
                    return fallback
                parsed = json.loads(text_block["text"])
                return _sanitize(parsed, categories, fallback)
    except Exception:
        return fallback
