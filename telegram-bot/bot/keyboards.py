from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu() -> InlineKeyboardMarkup:
    rows = [
        [("📰 Yangiliklar", "articles"), ("➕ Yangi maqola", "article_new")],
        [("📝 Draftlar", "articles:DRAFT"), ("✅ Review", "articles:REVIEW")],
        [("🔥 Breaking", "toggle:breaking"), ("⭐ Featured", "toggle:featured")],
        [("📊 Statistika", "stats"), ("💬 Izohlar", "comments")],
        [("📢 Reklama", "ads"), ("⚙️ Sozlamalar", "settings")],
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=text, callback_data=data) for text, data in row]
            for row in rows
        ]
    )


def status_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Draft", callback_data="new_status:DRAFT"),
                InlineKeyboardButton(text="Review", callback_data="new_status:REVIEW"),
            ],
            [
                InlineKeyboardButton(text="Published", callback_data="new_status:PUBLISHED"),
                InlineKeyboardButton(text="Scheduled", callback_data="new_status:SCHEDULED"),
            ],
        ]
    )


def visibility_keyboard(selected: set[str] | None = None) -> InlineKeyboardMarkup:
    selected = selected or set()
    options = [
        ("Bosh sahifa", "showOnHome"),
        ("Slayder", "showInSlider"),
        ("Yon panel", "showInSidebar"),
        ("So'nggi", "showInLatest"),
        ("Ko'p o'qilgan", "showInPopular"),
        ("Breaking", "isBreaking"),
        ("Featured", "isFeatured"),
        ("Editor choice", "isEditorChoice"),
    ]
    buttons = []
    for label, key in options:
        mark = "✅ " if key in selected else ""
        buttons.append(InlineKeyboardButton(text=f"{mark}{label}", callback_data=f"vis:{key}"))
    return InlineKeyboardMarkup(
        inline_keyboard=[buttons[i:i + 2] for i in range(0, len(buttons), 2)] + [[InlineKeyboardButton(text="Davom etish", callback_data="vis_done")]]
    )


def confirm_keyboard(prefix: str, item_id: str | None = None) -> InlineKeyboardMarkup:
    suffix = f":{item_id}" if item_id else ""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"{prefix}_yes{suffix}"),
                InlineKeyboardButton(text="Bekor qilish", callback_data=f"{prefix}_no{suffix}"),
            ]
        ]
    )


def article_actions(article_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Published", callback_data=f"status:PUBLISHED:{article_id}"), InlineKeyboardButton(text="Archived", callback_data=f"status:ARCHIVED:{article_id}")],
            [InlineKeyboardButton(text="Trash", callback_data=f"trash_confirm:{article_id}")],
        ]
    )
