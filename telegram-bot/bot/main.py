from __future__ import annotations

import asyncio
import html
from collections import defaultdict
from io import BytesIO

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramRetryAfter
from aiogram.filters import CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, Message

from .ai_classifier import classify_article
from .api import BackendApi
from .config import load_settings
from .forward_cleaner import prepare_forward_post
from .keyboards import (
    MENU_ADS,
    MENU_ARTICLES,
    MENU_BACK,
    MENU_BREAKING,
    MENU_CANCEL,
    MENU_COMMENTS,
    MENU_CONTINUE,
    MENU_DRAFTS,
    MENU_FEATURED,
    MENU_NEW,
    MENU_REVIEW,
    MENU_SETTINGS,
    MENU_STATS,
    STATUS_LABELS,
    VISIBILITY_LABELS,
    ad_actions,
    article_actions,
    cancel_keyboard,
    category_reply_keyboard,
    comment_actions,
    confirm_keyboard,
    confirm_reply_keyboard,
    reply_menu,
    status_reply_keyboard,
    visibility_reply_keyboard,
)
from .states import ArticleCreate

settings = load_settings()
api = BackendApi(settings.api_base)
router = Router()
forward_semaphore = asyncio.Semaphore(settings.forward_concurrency)
media_group_buffers: dict[str, list[Message]] = defaultdict(list)
media_group_tasks: dict[str, asyncio.Task] = {}
media_group_lock = asyncio.Lock()


def allowed(user_id: int) -> bool:
    return user_id in settings.admin_ids


async def guard_message(message: Message) -> bool:
    if not message.from_user or not allowed(message.from_user.id):
        await message.answer("Bu bot faqat ruxsat berilgan admin Telegram IDlari uchun ishlaydi.")
        return False
    return True


async def guard_callback(callback: CallbackQuery) -> bool:
    if not callback.from_user or not allowed(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return False
    return True


async def safe_answer(message: Message, text: str, **kwargs) -> None:
    await message.answer(text, **kwargs)


async def show_main_menu(message: Message, text: str = "Admin menyu:") -> None:
    await message.answer(text, reply_markup=reply_menu())


async def request_or_error(message: Message, method: str, path: str, **kwargs) -> dict | None:
    try:
        return await api.request(message.from_user.id, method, path, **kwargs)
    except Exception as exc:
        await message.answer(f"Amal bajarilmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
        return None


TELEGRAM_FILE_DOWNLOAD_LIMIT = 20 * 1024 * 1024


def is_forwarded(message: Message) -> bool:
    return bool(getattr(message, "forward_origin", None) or getattr(message, "forward_from_chat", None) or getattr(message, "forward_from", None))


async def upload_forward_media(message: Message, bot: Bot) -> dict[str, str]:
    media = None
    filename = "forward-media.bin"
    content_type = "application/octet-stream"

    if message.photo:
        photo = message.photo[-1]
        media = photo
        filename = f"{photo.file_unique_id}.jpg"
        content_type = "image/jpeg"
    elif message.video:
        video = message.video
        # Telegram's cloud Bot API caps file downloads (getFile/download) at 20MB regardless of
        # the video's own size limit in the app, so anything larger fails inside bot.get_file below.
        if video.file_size and video.file_size > TELEGRAM_FILE_DOWNLOAD_LIMIT:
            return {"url": "", "message": "Media: video 20MB dan katta, Telegram bot API orqali yuklab bo'lmaydi."}
        media = video
        filename = f"{video.file_unique_id}.mp4"
        content_type = video.mime_type or "video/mp4"

    if not media:
        return {"url": "", "message": ""}

    try:
        file = await bot.get_file(media.file_id)
        downloaded = await bot.download(file)
        if isinstance(downloaded, BytesIO):
            content = downloaded.getvalue()
        else:
            content = downloaded.read()
        uploaded = await api.upload_media(message.from_user.id, content, filename, content_type)
        url = uploaded["url"] if uploaded["url"].startswith("http") else f"{api.origin}{uploaded['url']}"
        return {"url": url, "message": f"Media URL: {url}"}
    except Exception as exc:
        return {"url": "", "message": f"Media yuklanmadi: {html.escape(str(exc))}"}


async def upload_forward_media_many(messages: list[Message], bot: Bot) -> dict[str, list[str] | str]:
    urls: list[str] = []
    notes: list[str] = []
    for item in messages:
        media = await upload_forward_media(item, bot)
        if media["url"]:
            urls.append(media["url"])
        if media["message"]:
            notes.append(media["message"])
    return {"urls": urls, "message": "\n".join(notes)}


def prepared_post_message(prepared: dict[str, str], media_line: str) -> str:
    if not prepared["content"]:
        return (
            "Tozalash uchun matn topilmadi.\n"
            "Post captionida faqat link/reklama bo'lishi mumkin. Matnli xabar yuboring yoki caption qo'shing."
        )
    media_block = f"\n\n<b>{html.escape(media_line)}</b>" if media_line else ""
    return (
        "🧹 <b>Saytga joylashga tayyor matn</b>\n\n"
        f"<b>Sarlavha:</b>\n{html.escape(prepared['title'])}\n\n"
        f"<b>Qisqa tavsif:</b>\n{html.escape(prepared['summary'])}\n\n"
        f"<b>Asosiy matn:</b>\n{html.escape(prepared['content'])}"
        f"{media_block}\n\n"
        "Keraksiz kanal takliflari, t.me linklar, @username, hashtaglar va reklama chaqiriqlari olib tashlandi."
    )


@router.message(CommandStart())
async def start(message: Message, state: FSMContext):
    await state.clear()
    if not await guard_message(message):
        return
    try:
        user = await api.login_telegram(message.from_user.id)
    except PermissionError as exc:
        await message.answer(str(exc))
        return
    await show_main_menu(message, f"Assalomu alaykum, {html.escape(user['user']['name'])}. Admin menyu:")


@router.message(F.text.in_({MENU_BACK, MENU_CANCEL}))
async def cancel_or_back(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    await state.clear()
    await show_main_menu(message)


@router.message(F.text == MENU_STATS)
async def stats(message: Message):
    if not await guard_message(message):
        return
    data = await request_or_error(message, "GET", "/admin/dashboard/stats")
    if not data:
        return
    popular = "\n".join([f"- {html.escape(item['title'])}: {item['viewsCount']}" for item in data.get("popular", [])])
    await message.answer(
        "📊 <b>Statistika</b>\n"
        f"Jami yangiliklar: {data['totalArticles']}\n"
        f"Bugun qo'shilgan: {data['todayArticles']}\n"
        f"Jami ko'rishlar: {data['totalViews']}\n"
        f"Draft: {data['draftArticles']}\n"
        f"Review: {data['reviewArticles']}\n\n"
        f"<b>Eng ko'p o'qilganlar</b>\n{popular or 'Hali maʼlumot yoʻq'}",
        reply_markup=reply_menu(),
    )


async def send_articles(message: Message, status: str | None = None, flag: str | None = None):
    path = f"/admin/articles?status={status}" if status else "/admin/articles"
    data = await request_or_error(message, "GET", path)
    if not data:
        return
    items = data.get("items", [])
    if flag:
        items = [item for item in items if item.get(flag)]
    if not items:
        await message.answer("Maqolalar topilmadi.", reply_markup=reply_menu())
        return
    await message.answer("Topilgan maqolalar. Har bir maqola ostidagi amaldan foydalaning:", reply_markup=reply_menu())
    for item in items[:10]:
        try:
            await message.answer(
                f"<b>{html.escape(item['title'])}</b>\n"
                f"Status: {item['status']}\n"
                f"Kategoriya: {html.escape(item.get('category', {}).get('name', '-'))}\n"
                f"Ko'rishlar: {item['viewsCount']}",
                reply_markup=article_actions(item["id"]),
            )
        except TelegramRetryAfter as exc:
            await asyncio.sleep(exc.retry_after)
            await message.answer(
                f"<b>{html.escape(item['title'])}</b>\n"
                f"Status: {item['status']}\n"
                f"Kategoriya: {html.escape(item.get('category', {}).get('name', '-'))}\n"
                f"Ko'rishlar: {item['viewsCount']}",
                reply_markup=article_actions(item["id"]),
            )
        await asyncio.sleep(0.05)


@router.message(F.text == MENU_ARTICLES)
async def articles(message: Message):
    if await guard_message(message):
        await send_articles(message)


@router.message(F.text == MENU_DRAFTS)
async def drafts(message: Message):
    if await guard_message(message):
        await send_articles(message, status="DRAFT")


@router.message(F.text == MENU_REVIEW)
async def review(message: Message):
    if await guard_message(message):
        await send_articles(message, status="REVIEW")


@router.message(F.text == MENU_BREAKING)
async def breaking(message: Message):
    if await guard_message(message):
        await send_articles(message, flag="isBreaking")


@router.message(F.text == MENU_FEATURED)
async def featured(message: Message):
    if await guard_message(message):
        await send_articles(message, flag="isFeatured")


@router.message(F.text == MENU_COMMENTS)
async def comments(message: Message):
    if not await guard_message(message):
        return
    data = await request_or_error(message, "GET", "/admin/comments")
    if not data:
        return
    items = data.get("items", [])
    if not items:
        await message.answer("Izohlar topilmadi.", reply_markup=reply_menu())
        return
    for item in items[:10]:
        await message.answer(
            f"<b>{html.escape(item.get('name', 'Foydalanuvchi'))}</b>\n"
            f"Status: {item['status']}\n"
            f"Maqola: {html.escape(item.get('article', {}).get('title', '-'))}\n"
            f"{html.escape(item.get('body', ''))}",
            reply_markup=comment_actions(item["id"]),
        )


@router.message(F.text == MENU_ADS)
async def ads(message: Message):
    if not await guard_message(message):
        return
    data = await request_or_error(message, "GET", "/admin/advertisements")
    if not data:
        return
    items = data.get("items", [])
    if not items:
        await message.answer("Reklama topilmadi.", reply_markup=reply_menu())
        return
    for item in items[:10]:
        await message.answer(
            f"<b>{html.escape(item['title'])}</b>\nJoylashuv: {html.escape(item['placement'])}\nStatus: {item['status']}",
            reply_markup=ad_actions(item["id"]),
        )


@router.message(F.text == MENU_SETTINGS)
async def settings_message(message: Message):
    if not await guard_message(message):
        return
    user = api.get_user(message.from_user.id)
    if not user:
        try:
            data = await api.login_telegram(message.from_user.id)
            user = data["user"]
        except PermissionError as exc:
            await message.answer(str(exc), reply_markup=reply_menu())
            return
    await message.answer(
        "⚙️ <b>Sozlamalar</b>\n\n"
        f"👤 Admin: {html.escape(user.get('name', '-'))}\n"
        f"🔑 Rol: {html.escape(user.get('role', '-'))}\n"
        f"🌐 Backend API: {html.escape(api.base_url)}\n"
        f"🖥️ Web admin panel: {html.escape(settings.admin_panel_url)}\n\n"
        "Kategoriya, reklama, foydalanuvchi va boshqa chuqur sozlamalar web admin panelda boshqariladi.",
        reply_markup=reply_menu(),
    )


@router.message(StateFilter(None), F.forward_origin)
async def clean_forwarded_post(message: Message, state: FSMContext, bot: Bot):
    if not await guard_message(message):
        return
    if message.media_group_id:
        await enqueue_forward_media_group(message, bot)
        return
    raw_text = message.caption or message.text or ""
    prepared = prepare_forward_post(raw_text)
    if len(prepared["content"]) < 20:
        await message.answer(
            "Forward qilingan postda saytga joylash uchun yetarli matn topilmadi. Caption/matn qo'shib qayta forward qiling.",
            reply_markup=reply_menu(),
        )
        return

    status = await message.answer(
        "Navbatga olindi. Bot bir vaqtning o'zida "
        f"{settings.forward_concurrency} ta forwardni qayta ishlaydi."
        if forward_semaphore.locked()
        else "Qabul qilindi. Forward qilingan post tahlil qilinmoqda..."
    )
    async with forward_semaphore:
        await process_forwarded_post([message], bot, prepared, status)


async def enqueue_forward_media_group(message: Message, bot: Bot) -> None:
    key = f"{message.chat.id}:{message.media_group_id}"
    async with media_group_lock:
        media_group_buffers[key].append(message)
        task = media_group_tasks.get(key)
        if task and not task.done():
            task.cancel()
        media_group_tasks[key] = asyncio.create_task(process_media_group_after_delay(key, bot))


async def process_media_group_after_delay(key: str, bot: Bot) -> None:
    try:
        await asyncio.sleep(1.5)
        async with media_group_lock:
            messages = media_group_buffers.pop(key, [])
            media_group_tasks.pop(key, None)
        if messages:
            await handle_forward_media_group(messages, bot)
    except asyncio.CancelledError:
        return


async def handle_forward_media_group(messages: list[Message], bot: Bot) -> None:
    first = messages[0]
    raw_text = next((item.caption or item.text or "" for item in messages if item.caption or item.text), "")
    prepared = prepare_forward_post(raw_text)
    if len(prepared["content"]) < 20:
        await first.answer(
            "Forward qilingan albomda saytga joylash uchun yetarli matn topilmadi. Caption/matn qo'shib qayta forward qiling.",
            reply_markup=reply_menu(),
        )
        return
    status = await first.answer(
        "Albom navbatga olindi. Bot bir vaqtning o'zida "
        f"{settings.forward_concurrency} ta forwardni qayta ishlaydi."
        if forward_semaphore.locked()
        else f"Qabul qilindi. Albomdagi {len(messages)} ta media tahlil qilinmoqda..."
    )
    async with forward_semaphore:
        await process_forwarded_post(messages, bot, prepared, status)


async def process_forwarded_post(messages: list[Message], bot: Bot, prepared: dict[str, str], status: Message) -> None:
    message = messages[0]
    await status.edit_text("Forward qilingan post tahlil qilinmoqda va admin panelga yuborilmoqda...")
    media = await upload_forward_media_many(messages, bot)
    media_urls = media["urls"] if isinstance(media["urls"], list) else []
    categories = await request_or_error(message, "GET", "/categories")
    if not categories:
        await status.delete()
        return
    classification = await classify_article(prepared["content"], categories, settings.openai_api_key)
    payload = {
        **prepared,
        "mainImage": media_urls[0] if media_urls else "",
        "gallery": media_urls[1:],
        "categoryId": classification["categoryId"],
        "extraCategoryIds": classification.get("extraCategoryIds", []),
        "status": "REVIEW",
        "showOnHome": classification.get("showOnHome", True),
        "showInSlider": classification.get("showInSlider", False),
        "showInSidebar": classification.get("showInSidebar", False),
        "showInLatest": classification.get("showInLatest", True),
        "showInPopular": classification.get("showInPopular", False),
        "isBreaking": classification.get("isBreaking", False),
        "isFeatured": classification.get("isFeatured", False),
        "isEditorChoice": classification.get("isEditorChoice", False),
        "seoTitle": prepared["title"],
        "seoDescription": prepared["summary"],
    }
    saved = await request_or_error(message, "POST", "/admin/articles", json=payload)
    await status.delete()
    if not saved:
        return
    category = next((item for item in categories if item["id"] == payload["categoryId"]), None)
    extra_names = [
        item["name"]
        for item in categories
        if item["id"] in set(payload["extraCategoryIds"])
    ]
    media_note = f"\n{html.escape(str(media['message']))}" if media["message"] else ""
    await message.answer(
        "✅ <b>Maqola admin panelga REVIEW sifatida yuborildi.</b>\n\n"
        f"<b>Sarlavha:</b> {html.escape(saved['title'])}\n"
        f"<b>Asosiy bo'lim:</b> {html.escape(category['name'] if category else '-')}\n"
        f"<b>Qo'shimcha bo'limlar:</b> {html.escape(', '.join(extra_names) if extra_names else '-')}\n"
        f"<b>Media:</b> {len(media_urls)} ta fayl yuklandi\n"
        f"<b>AI rejimi:</b> {html.escape('AI' if classification.get('source') == 'ai' else 'fallback')}\n"
        f"<b>Ko'rinish:</b> home={payload['showOnHome']}, slider={payload['showInSlider']}, latest={payload['showInLatest']}, breaking={payload['isBreaking']}, featured={payload['isFeatured']}"
        f"{media_note}\n\n"
        f"Admin panelda tekshirib, kerak bo'lsa to'g'rilab Publish qiling:\n{html.escape(settings.admin_panel_url)}",
        reply_markup=reply_menu(),
    )


@router.message(F.text == MENU_NEW)
async def article_new(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    await state.clear()
    await state.set_state(ArticleCreate.title)
    await message.answer("1/9 Sarlavhani yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.title)
async def set_title(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 3:
        await message.answer("Sarlavha kamida 3 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(title=message.text.strip())
    await state.set_state(ArticleCreate.summary)
    await message.answer("2/9 Qisqa tavsifni yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.summary)
async def set_summary(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 10:
        await message.answer("Qisqa tavsif kamida 10 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(summary=message.text.strip())
    await state.set_state(ArticleCreate.content)
    await message.answer("3/9 Asosiy matnni yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.content)
async def set_content(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 20:
        await message.answer("Asosiy matn kamida 20 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(content=message.text.strip())
    await state.set_state(ArticleCreate.image)
    await message.answer("4/9 Rasm URL yuboring yoki '-' deb o'tkazib yuboring:", reply_markup=cancel_keyboard())


async def proceed_to_category(message: Message, state: FSMContext) -> None:
    categories = await request_or_error(message, "GET", "/categories")
    if not categories:
        return
    await state.update_data(categoryOptions={item["name"]: item["id"] for item in categories})
    await state.set_state(ArticleCreate.category)
    await message.answer("5/9 Kategoriyani tanlang:", reply_markup=category_reply_keyboard(categories))


@router.message(ArticleCreate.image, F.photo)
async def set_image_photo(message: Message, state: FSMContext, bot: Bot):
    if not await guard_message(message):
        return
    photo = message.photo[-1]
    status_message = await message.answer("Rasm yuklanmoqda...")
    try:
        file = await bot.get_file(photo.file_id)
        buffer = await bot.download(file)
        uploaded = await api.upload_media(message.from_user.id, buffer.read(), f"{photo.file_unique_id}.jpg", "image/jpeg")
    except Exception as exc:
        await status_message.edit_text(
            f"Rasm yuklanmadi: {html.escape(str(exc))}\nQayta urinib ko'ring, boshqa rasm yuboring yoki URL/'-' yuboring."
        )
        return
    await state.update_data(mainImage=f"{api.origin}{uploaded['url']}")
    await status_message.edit_text("✅ Rasm yuklandi.")
    await proceed_to_category(message, state)


@router.message(ArticleCreate.image)
async def set_image(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    image = "" if message.text == "-" else (message.text or "").strip()
    if image and not image.startswith(("http://", "https://")):
        await message.answer("Rasm URL http:// yoki https:// bilan boshlanishi kerak, rasm yuklang yoki '-' yuboring.")
        return
    await state.update_data(mainImage=image)
    await proceed_to_category(message, state)


@router.message(ArticleCreate.category)
async def set_category(message: Message, state: FSMContext):
    data = await state.get_data()
    options = data.get("categoryOptions", {})
    category_id = options.get(message.text)
    if not category_id:
        await message.answer("Kategoriyani pastdagi klaviaturadan tanlang.")
        return
    await state.update_data(categoryId=category_id)
    await state.set_state(ArticleCreate.status)
    await message.answer("6/9 Statusni tanlang:", reply_markup=status_reply_keyboard())


@router.message(ArticleCreate.status)
async def set_status(message: Message, state: FSMContext):
    status = STATUS_LABELS.get(message.text or "")
    if not status:
        await message.answer("Statusni pastdagi klaviaturadan tanlang.")
        return
    await state.update_data(status=status, visibility=[])
    await state.set_state(ArticleCreate.visibility)
    await message.answer("7/9 Qayerda ko'rinishini tanlang. Tanlab bo'lgach Davom etish bosing.", reply_markup=visibility_reply_keyboard())


@router.message(ArticleCreate.visibility)
async def set_visibility(message: Message, state: FSMContext):
    if message.text == MENU_CONTINUE:
        data = await state.get_data()
        await state.set_state(ArticleCreate.preview)
        await message.answer(
            "8/9 <b>Preview</b>\n"
            f"Sarlavha: {html.escape(data['title'])}\n"
            f"Tavsif: {html.escape(data['summary'])}\n"
            f"Status: {data['status']}\n"
            f"Ko'rinish: {', '.join(data.get('visibility', [])) or 'default'}",
            reply_markup=confirm_reply_keyboard(),
        )
        return

    label = (message.text or "").replace("✅ ", "")
    key = VISIBILITY_LABELS.get(label)
    if not key:
        await message.answer("Ko'rinish turini pastdagi klaviaturadan tanlang.")
        return
    data = await state.get_data()
    selected = set(data.get("visibility", []))
    selected.remove(key) if key in selected else selected.add(key)
    await state.update_data(visibility=list(selected))
    await message.answer("Tanlov yangilandi.", reply_markup=visibility_reply_keyboard(selected))


@router.message(ArticleCreate.preview)
async def save_article(message: Message, state: FSMContext):
    if message.text != "✅ Tasdiqlash":
        await state.clear()
        await show_main_menu(message, "Maqola saqlanmadi.")
        return
    data = await state.get_data()
    visibility = set(data.pop("visibility", []))
    data.pop("categoryOptions", None)
    payload = {
        **data,
        **{key: key in visibility for key in ["showOnHome", "showInSlider", "showInSidebar", "showInLatest", "showInPopular", "isBreaking", "isFeatured", "isEditorChoice"]},
    }
    saved = await request_or_error(message, "POST", "/admin/articles", json=payload)
    await state.clear()
    if saved:
        await message.answer(f"9/9 Maqola saqlandi: <b>{html.escape(saved['title'])}</b>", reply_markup=reply_menu())


@router.callback_query(F.data.startswith("status:"))
async def change_status(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    _, status, article_id = callback.data.split(":")
    try:
        data = await api.request(callback.from_user.id, "PATCH", f"/admin/articles/{article_id}/status", json={"status": status})
        await callback.message.answer(f"Status yangilandi: <b>{data['status']}</b>", reply_markup=reply_menu())
    except Exception as exc:
        await callback.message.answer(f"Status yangilanmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
    await callback.answer()


@router.callback_query(F.data.startswith("trash_confirm:"))
async def trash_confirm(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    article_id = callback.data.split(":")[1]
    await callback.message.answer("Maqolani trashga yuborishni tasdiqlaysizmi?", reply_markup=confirm_keyboard("trash", article_id))
    await callback.answer()


@router.callback_query(F.data.startswith("trash_yes:"))
async def trash_yes(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    article_id = callback.data.split(":")[1]
    try:
        await api.request(callback.from_user.id, "DELETE", f"/admin/articles/{article_id}")
        await callback.message.answer("Maqola trashga yuborildi.", reply_markup=reply_menu())
    except Exception as exc:
        await callback.message.answer(f"Trash amali bajarilmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
    await callback.answer()


@router.callback_query(F.data.startswith("comment:"))
async def change_comment(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    _, status, comment_id = callback.data.split(":")
    try:
        await api.request(callback.from_user.id, "PATCH", f"/admin/comments/{comment_id}/status", json={"status": status})
        await callback.message.answer(f"Izoh statusi yangilandi: <b>{status}</b>", reply_markup=reply_menu())
    except Exception as exc:
        await callback.message.answer(f"Izoh yangilanmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
    await callback.answer()


@router.callback_query(F.data.startswith("comment_trash_confirm:"))
async def comment_trash_confirm(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    comment_id = callback.data.split(":")[1]
    await callback.message.answer("Izohni o'chirishni tasdiqlaysizmi?", reply_markup=confirm_keyboard("comment_trash", comment_id))
    await callback.answer()


@router.callback_query(F.data.startswith("comment_trash_yes:"))
async def comment_trash_yes(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    comment_id = callback.data.split(":")[1]
    try:
        await api.request(callback.from_user.id, "PATCH", f"/admin/comments/{comment_id}/status", json={"status": "DELETED"})
        await callback.message.answer("Izoh o'chirildi.", reply_markup=reply_menu())
    except Exception as exc:
        await callback.message.answer(f"Izoh o'chirilmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
    await callback.answer()


@router.callback_query(F.data.contains("_no:"))
async def cancel_confirm(callback: CallbackQuery):
    await callback.answer("Bekor qilindi")


@router.callback_query(F.data.startswith("ad:"))
async def change_ad(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    _, status, ad_id = callback.data.split(":")
    try:
        await api.request(callback.from_user.id, "PATCH", f"/admin/advertisements/{ad_id}/status", json={"status": status})
        await callback.message.answer(f"Reklama statusi yangilandi: <b>{status}</b>", reply_markup=reply_menu())
    except Exception as exc:
        await callback.message.answer(f"Reklama yangilanmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
    await callback.answer()


@router.message()
async def fallback(message: Message, state: FSMContext):
    current_state = await state.get_state()
    if current_state:
        return
    if await guard_message(message):
        await show_main_menu(message, "Tushunmadim. Pastdagi menyudan amal tanlang.")


async def main() -> None:
    bot = Bot(settings.token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher(storage=MemoryStorage())
    dispatcher.include_router(router)
    await dispatcher.start_polling(bot, drop_pending_updates=True)


if __name__ == "__main__":
    asyncio.run(main())
