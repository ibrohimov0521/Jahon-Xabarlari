from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

MENU_ARTICLES = "🗞️ Yangiliklar"
MENU_NEW = "✍️ Yangi maqola"
MENU_DRAFTS = "🗂️ Draftlar"
MENU_REVIEW = "🛡️ Review"
MENU_BREAKING = "🚨 Breaking"
MENU_FEATURED = "💎 Featured"
MENU_STATS = "📈 Statistika"
MENU_COMMENTS = "💬 Izohlar"
MENU_ADS = "📣 Reklama"
MENU_SETTINGS = "⚙️ Sozlamalar"
MENU_INSTAGRAM = "Instagram"
MENU_BACK = "↩️ Menyu"
MENU_CANCEL = "✖️ Bekor qilish"
MENU_CONTINUE = "➡️ Davom etish"

VISITOR_CANCEL = "Bekor qilish"
INSTAGRAM_POST = "Instagram Post"
INSTAGRAM_REEL = "Instagram Reel"

STATUS_LABELS = {
    "Draft": "DRAFT",
    "Review": "REVIEW",
    "Published": "PUBLISHED",
}

VISIBILITY_LABELS = {
    "Bosh sahifa": "showOnHome",
    "Slayder": "showInSlider",
    "Yon panel": "showInSidebar",
    "So'nggi": "showInLatest",
    "Ko'p o'qilgan": "showInPopular",
    "Breaking": "isBreaking",
    "Featured": "isFeatured",
    "Editor choice": "isEditorChoice",
}


def reply_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=MENU_NEW)],
            [KeyboardButton(text=MENU_ARTICLES), KeyboardButton(text=MENU_STATS)],
            [KeyboardButton(text=MENU_INSTAGRAM)],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Yangilik qo'shish, o'chirish yoki statistika",
    )


def visitor_phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Telefon raqamimni yuborish", request_contact=True)],
            [KeyboardButton(text=VISITOR_CANCEL)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Telefon raqamingizni yuboring",
    )


def visitor_message_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=VISITOR_CANCEL)]],
        resize_keyboard=True,
        input_field_placeholder="Murojaatingizni yozing",
    )


def cancel_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=MENU_CANCEL), KeyboardButton(text=MENU_BACK)]],
        resize_keyboard=True,
    )


def status_reply_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Draft"), KeyboardButton(text="Review")],
            [KeyboardButton(text="Published")],
            [KeyboardButton(text=MENU_CANCEL)],
        ],
        resize_keyboard=True,
    )


def instagram_format_reply_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=INSTAGRAM_POST), KeyboardButton(text=INSTAGRAM_REEL)],
            [KeyboardButton(text=MENU_CANCEL)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Instagram uchun Post yoki Reel tanlang",
    )


def category_reply_keyboard(categories: list[dict]) -> ReplyKeyboardMarkup:
    rows = [[KeyboardButton(text=item["name"])] for item in categories]
    rows.append([KeyboardButton(text=MENU_CANCEL)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def visibility_reply_keyboard(selected: set[str] | None = None) -> ReplyKeyboardMarkup:
    selected = selected or set()
    rows = []
    labels = list(VISIBILITY_LABELS.items())
    for i in range(0, len(labels), 2):
        row = []
        for label, key in labels[i:i + 2]:
            prefix = "✅ " if key in selected else ""
            row.append(KeyboardButton(text=f"{prefix}{label}"))
        rows.append(row)
    rows.append([KeyboardButton(text=MENU_CONTINUE), KeyboardButton(text=MENU_CANCEL)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def confirm_reply_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="✅ Tasdiqlash"), KeyboardButton(text=MENU_CANCEL)]],
        resize_keyboard=True,
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


def instagram_settings_keyboard(admin_panel_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Web panelda boshqarish", url=f"{admin_panel_url}?section=instagram")]
        ]
    )


def article_actions(article_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🗑️ Trash", callback_data=f"trash_confirm:{article_id}")],
        ]
    )


def comment_actions(comment_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"comment:APPROVED:{comment_id}"),
                InlineKeyboardButton(text="🗑️ O'chirish", callback_data=f"comment_trash_confirm:{comment_id}"),
            ]
        ]
    )


def ad_actions(ad_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🟢 Active", callback_data=f"ad:ACTIVE:{ad_id}"),
                InlineKeyboardButton(text="⏸️ Paused", callback_data=f"ad:PAUSED:{ad_id}"),
            ],
            [
                InlineKeyboardButton(text="🗂️ Draft", callback_data=f"ad:DRAFT:{ad_id}"),
                InlineKeyboardButton(text="⏳ Expired", callback_data=f"ad:EXPIRED:{ad_id}"),
            ],
        ]
    )
