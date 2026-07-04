from __future__ import annotations

import re


PROMO_PATTERNS = [
    r"\bobuna\s+bo[ʻ'`]?ling\b",
    r"\bkanal(?:imiz)?ga\s+(?:a[ʼ']zo\s+bo[ʻ'`]?ling|qo[ʻ'`]?shiling|ulaning)\b",
    r"\bbizni\s+(?:kuzating|kanalda\s+kuzating)\b",
    r"\bdo[ʻ'`]?stlarga\s+ulashing\b",
    r"\bshare\b",
    r"\breklama\b",
    r"\bmanba\s*[:：]",
    r"\brasmiy\s+kanal\b",
    r"^\W*rasman\W*$",
    r"^\W*official\W*$",
]

URL_RE = re.compile(r"(?:https?://|t\.me/|telegram\.me/|www\.)\S+", re.IGNORECASE)
MENTION_RE = re.compile(r"(?<!\w)@\w+")
HASHTAG_RE = re.compile(r"(?<!\w)#\w+")
FLAG_RE = re.compile(r"[\U0001F1E6-\U0001F1FF]{2}")
LEADING_NOISE_RE = re.compile(r"^[\s?✅☑️✔️🔴🟢🟡⚽️🏆📌📍👉➡️⬇️\-\–—•·:]+")

CYRILLIC_TO_LATIN = {
    "А": "A",
    "а": "a",
    "Б": "B",
    "б": "b",
    "В": "V",
    "в": "v",
    "Г": "G",
    "г": "g",
    "Д": "D",
    "д": "d",
    "Е": "E",
    "е": "e",
    "Ё": "Yo",
    "ё": "yo",
    "Ж": "J",
    "ж": "j",
    "З": "Z",
    "з": "z",
    "И": "I",
    "и": "i",
    "Й": "Y",
    "й": "y",
    "К": "K",
    "к": "k",
    "Л": "L",
    "л": "l",
    "М": "M",
    "м": "m",
    "Н": "N",
    "н": "n",
    "О": "O",
    "о": "o",
    "П": "P",
    "п": "p",
    "Р": "R",
    "р": "r",
    "С": "S",
    "с": "s",
    "Т": "T",
    "т": "t",
    "У": "U",
    "у": "u",
    "Ф": "F",
    "ф": "f",
    "Х": "X",
    "х": "x",
    "Ц": "Ts",
    "ц": "ts",
    "Ч": "Ch",
    "ч": "ch",
    "Ш": "Sh",
    "ш": "sh",
    "Ъ": "",
    "ъ": "",
    "Ь": "",
    "ь": "",
    "Э": "E",
    "э": "e",
    "Ю": "Yu",
    "ю": "yu",
    "Я": "Ya",
    "я": "ya",
    "Ў": "O'",
    "ў": "o'",
    "Қ": "Q",
    "қ": "q",
    "Ғ": "G'",
    "ғ": "g'",
    "Ҳ": "H",
    "ҳ": "h",
}


def transliterate_cyrillic(text: str) -> str:
    return "".join(CYRILLIC_TO_LATIN.get(char, char) for char in text)


def is_promo_line(line: str) -> bool:
    normalized = line.lower().replace("’", "'").replace("‘", "'").replace("`", "'")
    if URL_RE.search(normalized) or MENTION_RE.search(normalized):
        return True
    return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in PROMO_PATTERNS)


def clean_forward_text(raw_text: str) -> str:
    text = transliterate_cyrillic(raw_text or "")
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = FLAG_RE.sub("", line)
        line = LEADING_NOISE_RE.sub("", line).strip()
        if is_promo_line(line):
            continue
        line = URL_RE.sub("", line)
        line = MENTION_RE.sub("", line)
        line = HASHTAG_RE.sub("", line)
        line = LEADING_NOISE_RE.sub("", line).strip()
        line = re.sub(r"\s{2,}", " ", line)
        if len(line) < 2:
            continue
        lines.append(line)

    cleaned = "\n\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def make_title(content: str) -> str:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    joined = " ".join(lines)
    years = re.findall(r"\b20\d{2}\b", joined)
    lower = joined.lower()
    if "jahon chempionati" in lower and len(set(years)) >= 2:
        return f"{' va '.join(dict.fromkeys(years[:2]))}-yilgi Jahon Chempionati mezbonlari ma'lum bo'ldi"
    first = re.split(r"(?<=[.!?])\s+", joined)[0] if joined else "Yangi xabar"
    first = first.strip(" -–—")
    if len(first) <= 95:
        return first
    return first[:92].rstrip() + "..."


def make_summary(content: str) -> str:
    joined = " ".join(line.strip() for line in content.splitlines() if line.strip())
    if len(joined) <= 180:
        return joined
    return joined[:177].rstrip() + "..."


def prepare_forward_post(raw_text: str) -> dict[str, str]:
    content = clean_forward_text(raw_text)
    return {
        "title": make_title(content),
        "summary": make_summary(content),
        "content": content,
    }
