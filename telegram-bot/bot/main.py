from __future__ import annotations

import asyncio
import html
import logging
import re
from collections import defaultdict
from io import BytesIO
from typing import Any

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramRetryAfter
from aiogram.filters import Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove

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
    MENU_INSTAGRAM,
    INSTAGRAM_POST,
    INSTAGRAM_REEL,
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
    instagram_format_reply_keyboard,
    instagram_settings_keyboard,
    inquiry_actions,
    inquiry_reply_keyboard,
    reply_menu,
    status_reply_keyboard,
    VISITOR_CANCEL,
    visibility_reply_keyboard,
    visitor_message_keyboard,
    visitor_phone_keyboard,
)
from .states import AdminInquiryReply, ArticleCreate, UserInquiry

settings = load_settings()
api = BackendApi(settings.api_base, settings.service_secret)
router = Router()
logger = logging.getLogger(__name__)
forward_semaphore = asyncio.Semaphore(settings.forward_concurrency)
media_group_buffers: dict[str, list[Message]] = defaultdict(list)
media_group_tasks: dict[str, asyncio.Task] = {}
media_group_lock = asyncio.Lock()
phone_pattern = re.compile(r"^[0-9+()\\-\\s]{7,32}$")


def is_video_url(url: str) -> bool:
    return bool(re.search(r"\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$", url, re.IGNORECASE))


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


async def show_main_menu(message: Message, text: str = "Admin menyu:") -> None:
    await message.answer(text, reply_markup=reply_menu())


async def request_or_error(message: Message, method: str, path: str, **kwargs) -> Any | None:
    if not message.from_user:
        return None
    try:
        return await api.request(message.from_user.id, method, path, **kwargs)
    except Exception as exc:
        await message.answer(f"Amal bajarilmadi: {html.escape(str(exc))}", reply_markup=reply_menu())
        return None


TELEGRAM_FILE_DOWNLOAD_LIMIT = 20 * 1024 * 1024


async def safe_delete(message: Message) -> None:
    try:
        await message.delete()
    except Exception:
        logger.debug("Telegram xabarini o'chirib bo'lmadi", exc_info=True)


async def safe_edit(message: Message, text: str) -> None:
    try:
        await message.edit_text(text)
    except Exception:
        logger.debug("Telegram xabarini tahrirlab bo'lmadi", exc_info=True)


def absolute_media_url(url: str) -> str:
    return url if url.startswith(("http://", "https://")) else f"{api.origin}{url}"


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
        url = absolute_media_url(uploaded["url"])
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


@router.message(CommandStart())
async def start(message: Message, state: FSMContext):
    await state.clear()
    if not message.from_user:
        return
    if not allowed(message.from_user.id):
        await state.set_state(UserInquiry.phone)
        await message.answer(
            "Assalomu alaykum. Bu bot tahririyat bilan bog'lanish uchun ishlaydi. "
            "Sizda admin huquqi yo'q. Admin siz bilan bog'lanishi uchun telefon raqamingizni yuboring.",
            reply_markup=visitor_phone_keyboard(),
        )
        return
    try:
        user = await api.login_telegram(message.from_user.id)
    except PermissionError as exc:
        await message.answer(str(exc))
        return
    await show_main_menu(message, f"Assalomu alaykum, {html.escape(user['user']['name'])}. Admin menyu:")


def valid_phone(value: str) -> bool:
    return bool(phone_pattern.fullmatch(value.strip())) and 7 <= len(re.sub(r"\D", "", value)) <= 15


async def request_inquiry_message(message: Message, state: FSMContext, phone: str) -> None:
    await state.update_data(phone=phone.strip())
    await state.set_state(UserInquiry.message)
    await message.answer(
        "Rahmat. Endi murojaatingizni qisqacha yozing. Tahririyat siz bilan ko'rsatilgan raqam orqali bog'lanadi.",
        reply_markup=visitor_message_keyboard(),
    )


@router.message(UserInquiry.phone, F.contact)
async def visitor_contact_phone(message: Message, state: FSMContext) -> None:
    if not message.contact or not valid_phone(message.contact.phone_number):
        await message.answer("Telefon raqamini qayta yuboring.", reply_markup=visitor_phone_keyboard())
        return
    await request_inquiry_message(message, state, message.contact.phone_number)


@router.message(UserInquiry.phone, F.text)
async def visitor_text_phone(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if text == VISITOR_CANCEL:
        await state.clear()
        await message.answer("Murojaat bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    if not valid_phone(text):
        await message.answer("Telefon raqamingizni yuboring yoki pastdagi tugmadan foydalaning.", reply_markup=visitor_phone_keyboard())
        return
    await request_inquiry_message(message, state, text)


@router.message(UserInquiry.message, F.text)
async def visitor_inquiry(message: Message, state: FSMContext, bot: Bot) -> None:
    text = (message.text or "").strip()
    if text == VISITOR_CANCEL:
        await state.clear()
        await message.answer("Murojaat bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    if len(text) < 5:
        await message.answer("Murojaat kamida 5 belgidan iborat bo'lsin.", reply_markup=visitor_message_keyboard())
        return
    data = await state.get_data()
    phone = str(data.get("phone", "-"))
    sender = message.from_user
    if not sender:
        return
    username = f"@{sender.username}" if sender.username else "yo'q"
    admin_text = (
        "<b>Yangi foydalanuvchi murojaati</b>\n\n"
        f"<b>Ism:</b> {html.escape(sender.full_name)}\n"
        f"<b>Username:</b> {html.escape(username)}\n"
        f"<b>Telegram ID:</b> <code>{sender.id}</code>\n"
        f"<b>Telefon:</b> <code>{html.escape(phone)}</code>\n\n"
        f"<b>Murojaat:</b>\n{html.escape(text)}"
    )
    delivered = 0
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, admin_text, reply_markup=inquiry_actions(sender.id))
            delivered += 1
        except TelegramRetryAfter as exc:
            await asyncio.sleep(exc.retry_after)
            await bot.send_message(admin_id, admin_text, reply_markup=inquiry_actions(sender.id))
            delivered += 1
        except Exception:
            logger.exception("Foydalanuvchi murojaati admin %s ga yuborilmadi", admin_id)
    await state.clear()
    if delivered:
        await message.answer("Murojaatingiz tahririyatga yuborildi. Tez orada siz bilan bog'lanamiz.", reply_markup=ReplyKeyboardRemove())
    else:
        await message.answer("Murojaatni yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.", reply_markup=ReplyKeyboardRemove())


async def send_inquiry_reply(bot: Bot, target_user_id: int, reply_text: str) -> None:
    await bot.send_message(
        target_user_id,
        "<b>BEST Team NEWS tahririyatidan javob:</b>\n\n" + html.escape(reply_text),
    )


async def begin_inquiry_reply(message: Message, state: FSMContext, target_user_id: int) -> None:
    await state.set_state(AdminInquiryReply.message)
    await state.update_data(inquiry_target_user_id=target_user_id)
    await message.answer(
        f"Telegram ID <code>{target_user_id}</code> foydalanuvchisiga javobingizni yozing:",
        reply_markup=inquiry_reply_keyboard(),
    )


@router.callback_query(F.data.startswith("inquiry_reply:"))
async def inquiry_reply_callback(callback: CallbackQuery, state: FSMContext) -> None:
    if not await guard_callback(callback):
        return
    try:
        target_user_id = int((callback.data or "").split(":", 1)[1])
    except (IndexError, ValueError):
        await callback.answer("Foydalanuvchi IDsi noto'g'ri", show_alert=True)
        return
    if not callback.message:
        await callback.answer("Xabar topilmadi", show_alert=True)
        return
    await begin_inquiry_reply(callback.message, state, target_user_id)
    await callback.answer()


@router.message(Command("reply"))
async def inquiry_reply_command(message: Message, state: FSMContext, bot: Bot) -> None:
    if not await guard_message(message):
        return
    parts = (message.text or "").strip().split(maxsplit=2)
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer(
            "Foydalanish: <code>/reply TELEGRAM_ID javob matni</code>"
        )
        return
    target_user_id = int(parts[1])
    if len(parts) == 2:
        await begin_inquiry_reply(message, state, target_user_id)
        return
    try:
        await send_inquiry_reply(bot, target_user_id, parts[2].strip())
    except Exception as exc:
        logger.exception("Murojaat javobi %s foydalanuvchiga yuborilmadi", target_user_id)
        await message.answer(
            "Javob yuborilmadi. Foydalanuvchi botni bloklagan bo'lishi mumkin: "
            f"{html.escape(str(exc))}",
            reply_markup=reply_menu(),
        )
        return
    await message.answer("Javob foydalanuvchiga yuborildi.", reply_markup=reply_menu())


@router.message(AdminInquiryReply.message, F.text)
async def inquiry_reply_message(message: Message, state: FSMContext, bot: Bot) -> None:
    if not await guard_message(message):
        await state.clear()
        return
    reply_text = (message.text or "").strip()
    if reply_text in {VISITOR_CANCEL, MENU_CANCEL, MENU_BACK}:
        await state.clear()
        await message.answer("Javob berish bekor qilindi.", reply_markup=reply_menu())
        return
    if len(reply_text) < 2:
        await message.answer("Javob matnini yozing.", reply_markup=inquiry_reply_keyboard())
        return
    data = await state.get_data()
    target_user_id = int(data.get("inquiry_target_user_id", 0))
    if target_user_id <= 0:
        await state.clear()
        await message.answer("Foydalanuvchi IDsi topilmadi. Qayta urinib ko'ring.", reply_markup=reply_menu())
        return
    try:
        await send_inquiry_reply(bot, target_user_id, reply_text)
    except Exception as exc:
        logger.exception("Murojaat javobi %s foydalanuvchiga yuborilmadi", target_user_id)
        await message.answer(
            "Javob yuborilmadi. Foydalanuvchi botni bloklagan bo'lishi mumkin: "
            f"{html.escape(str(exc))}",
            reply_markup=reply_menu(),
        )
        await state.clear()
        return
    await state.clear()
    await message.answer("Javob foydalanuvchiga yuborildi.", reply_markup=reply_menu())


@router.message(Command("emojiid"))
async def custom_emoji_id(message: Message) -> None:
    if not await guard_message(message):
        return
    sources = (message, message.reply_to_message)
    ids = []
    for source in sources:
        if source is None:
            continue
        for entity in (source.entities or source.caption_entities or []):
            if getattr(entity.type, "value", entity.type) == "custom_emoji" and entity.custom_emoji_id:
                ids.append(entity.custom_emoji_id)
    if not ids:
        await message.answer(
            "Maxsus emoji bilan bir xabarda <code>/emojiid [emoji]</code> yuboring yoki "
            "emoji bor xabarga javob qilib <code>/emojiid</code> yozing.",
        )
        return
    custom_emoji_id = ids[0]
    fallback_emoji = "\U0001F4F0"
    try:
        stickers = await message.bot.get_custom_emoji_stickers(custom_emoji_ids=[custom_emoji_id])
        fallback_emoji = stickers[0].emoji or fallback_emoji
    except Exception:
        logger.exception("Maxsus emoji fallbacki olinmadi")
    await message.answer(
        "Kanal uchun backend sozlamalari:\n\n"
        f"<code>TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID={html.escape(custom_emoji_id)}</code>\n"
        f"<code>TELEGRAM_CHANNEL_CUSTOM_EMOJI_ALT={html.escape(fallback_emoji)}</code>\n\n"
        "Ikkalasini ham Backend service ichiga aynan shu ko'rinishda qo'ying. So'ng backend deployini kuting.",
    )


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


@router.message(F.text == MENU_INSTAGRAM)
async def instagram_settings_message(message: Message):
    if not await guard_message(message):
        return
    status = await request_or_error(message, "GET", "/admin/instagram/status")
    if not status:
        return
    enabled = "Yoqilgan" if status.get("enabled") else "O'chirilgan"
    ready = "Tayyor" if status.get("ready") else "Sozlash kerak"
    posts = status.get("posts") if isinstance(status.get("posts"), dict) else {}
    account = status.get("accountHint") or "kiritilmagan"
    latest_failure = status.get("latestFailure") if isinstance(status.get("latestFailure"), dict) else None
    failure_text = ""
    if latest_failure:
        latest_message = html.escape(str(latest_failure.get("message", "Noma'lum xato"))[:220])
        failure_text = f"\n\n<b>So'nggi xato:</b> {latest_message}"
    await message.answer(
        "<b>Instagram sozlamalari</b>\n\n"
        f"Avtomatik yuborish: <b>{enabled}</b>\n"
        f"Ulanish holati: <b>{ready}</b>\n"
        f"Akkaunt ID: <b>{html.escape(str(account))}</b>\n"
        f"Yuborilgan: <b>{int(posts.get('sent', 0))}</b>\n"
        f"Navbatda: <b>{int(posts.get('queued', 0))}</b>\n"
        f"Xato: <b>{int(posts.get('failed', 0))}</b>"
        f"{failure_text}\n\n"
        "Token xavfsizlik uchun botda ko'rsatilmaydi. Ulanish testi, token yo'riqnomasi va qayta yuborish web admin panelda mavjud.",
        reply_markup=instagram_settings_keyboard(settings.admin_panel_url),
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
        await asyncio.sleep(settings.media_group_delay)
        async with media_group_lock:
            messages = media_group_buffers.pop(key, [])
            media_group_tasks.pop(key, None)
        if messages:
            await handle_forward_media_group(messages, bot)
    except asyncio.CancelledError:
        return


async def handle_forward_media_group(messages: list[Message], bot: Bot) -> None:
    messages.sort(key=lambda item: item.message_id)
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
    await safe_edit(status, "Forward qilingan post tahlil qilinmoqda va admin panelga yuborilmoqda...")
    media = await upload_forward_media_many(messages, bot)
    media_urls = media["urls"] if isinstance(media["urls"], list) else []
    categories = await request_or_error(message, "GET", "/categories")
    if not isinstance(categories, list) or not categories:
        await safe_delete(status)
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
        "instagramEnabled": bool(media_urls),
        "instagramFormat": "REEL" if media_urls and is_video_url(media_urls[0]) else "POST" if media_urls else None,
    }
    saved = await request_or_error(message, "POST", "/admin/articles", json=payload)
    await safe_delete(status)
    if not isinstance(saved, dict):
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
    await message.answer("1/10 Sarlavhani yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.title)
async def set_title(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 3:
        await message.answer("Sarlavha kamida 3 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(title=message.text.strip())
    await state.set_state(ArticleCreate.summary)
    await message.answer("2/10 Qisqa tavsifni yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.summary)
async def set_summary(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 10:
        await message.answer("Qisqa tavsif kamida 10 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(summary=message.text.strip())
    await state.set_state(ArticleCreate.content)
    await message.answer("3/10 Asosiy matnni yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.content)
async def set_content(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if not message.text or len(message.text.strip()) < 20:
        await message.answer("Asosiy matn kamida 20 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(content=message.text.strip())
    await state.set_state(ArticleCreate.image)
    await message.answer("4/10 Rasm yoki video yuboring, URL yuboring yoki '-' deb o'tkazib yuboring:", reply_markup=cancel_keyboard())


async def proceed_to_category(message: Message, state: FSMContext) -> None:
    categories = await request_or_error(message, "GET", "/categories")
    if not categories:
        return
    await state.update_data(categoryOptions={item["name"]: item["id"] for item in categories})
    await state.set_state(ArticleCreate.category)
    await message.answer("6/10 Kategoriyani tanlang:", reply_markup=category_reply_keyboard(categories))


async def proceed_to_instagram_format(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    if not data.get("mainImage"):
        await state.update_data(instagramEnabled=False, instagramFormat=None)
        await proceed_to_category(message, state)
        return
    await state.set_state(ArticleCreate.instagram_format)
    await message.answer(
        "5/10 Instagram uchun formatni tanlang. Rasm uchun Post, video uchun Reel tanlanadi.",
        reply_markup=instagram_format_reply_keyboard(),
    )


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
    await state.update_data(mainImage=absolute_media_url(uploaded["url"]))
    await status_message.edit_text("✅ Rasm yuklandi.")
    await proceed_to_instagram_format(message, state)


@router.message(ArticleCreate.image, F.video)
async def set_image_video(message: Message, state: FSMContext, bot: Bot):
    if not await guard_message(message):
        return
    status_message = await message.answer("Video yuklanmoqda...")
    uploaded = await upload_forward_media(message, bot)
    if not uploaded["url"]:
        await status_message.edit_text(f"Video yuklanmadi. {uploaded['message'] or 'Qayta urinib ko\'ring.'}")
        return
    await state.update_data(mainImage=uploaded["url"])
    await status_message.edit_text("Video yuklandi.")
    await proceed_to_instagram_format(message, state)


@router.message(ArticleCreate.image)
async def set_image(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    image = "" if message.text == "-" else (message.text or "").strip()
    if image and not image.startswith(("http://", "https://")):
        await message.answer("Rasm URL http:// yoki https:// bilan boshlanishi kerak, rasm yuklang yoki '-' yuboring.")
        return
    await state.update_data(mainImage=image)
    await proceed_to_instagram_format(message, state)


@router.message(ArticleCreate.instagram_format)
async def set_instagram_format(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    selected = {INSTAGRAM_POST: "POST", INSTAGRAM_REEL: "REEL"}.get(message.text or "")
    if not selected:
        await message.answer("Instagram formatini pastdagi klaviaturadan tanlang.")
        return
    data = await state.get_data()
    video = is_video_url(data.get("mainImage", ""))
    if selected == "POST" and video:
        await message.answer("Video uchun Instagram Reel tanlang.")
        return
    if selected == "REEL" and not video:
        await message.answer("Instagram Reel uchun video yuboring. Rasm uchun Post tanlang.")
        return
    await state.update_data(instagramEnabled=True, instagramFormat=selected)
    await proceed_to_category(message, state)


@router.message(ArticleCreate.category)
async def set_category(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    data = await state.get_data()
    options = data.get("categoryOptions", {})
    category_id = options.get(message.text)
    if not category_id:
        await message.answer("Kategoriyani pastdagi klaviaturadan tanlang.")
        return
    await state.update_data(categoryId=category_id)
    await state.set_state(ArticleCreate.status)
    await message.answer("7/10 Statusni tanlang:", reply_markup=status_reply_keyboard())


@router.message(ArticleCreate.status)
async def set_status(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    status = STATUS_LABELS.get(message.text or "")
    if not status:
        await message.answer("Statusni pastdagi klaviaturadan tanlang.")
        return
    await state.update_data(status=status, visibility=[])
    await state.set_state(ArticleCreate.visibility)
    await message.answer("8/10 Qayerda ko'rinishini tanlang. Tanlab bo'lgach Davom etish bosing.", reply_markup=visibility_reply_keyboard())


@router.message(ArticleCreate.visibility)
async def set_visibility(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    if message.text == MENU_CONTINUE:
        data = await state.get_data()
        await state.set_state(ArticleCreate.preview)
        await message.answer(
            "9/10 <b>Preview</b>\n"
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
    if not await guard_message(message):
        return
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
        await message.answer(f"10/10 Maqola saqlandi: <b>{html.escape(saved['title'])}</b>", reply_markup=reply_menu())


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
    if not await guard_callback(callback):
        return
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
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    bot = Bot(settings.token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await bot.delete_webhook(drop_pending_updates=False)
    me = await bot.get_me()
    logger.info("Telegram bot polling started as @%s (%s)", me.username, me.id)
    redis_storage = RedisStorage.from_url(settings.redis_url, state_ttl=24 * 60 * 60, data_ttl=24 * 60 * 60)
    try:
        await redis_storage.redis.ping()
        storage = redis_storage
    except Exception:
        logger.exception("Redis ishlamayapti; bot vaqtincha xotira storage bilan ishga tushadi")
        await redis_storage.close()
        storage = MemoryStorage()
    dispatcher = Dispatcher(storage=storage)
    dispatcher.include_router(router)
    try:
        await dispatcher.start_polling(
            bot,
            drop_pending_updates=False,
            tasks_concurrency_limit=max(20, settings.forward_concurrency * 4),
        )
    finally:
        pending_group_tasks = list(media_group_tasks.values())
        for task in pending_group_tasks:
            task.cancel()
        if pending_group_tasks:
            await asyncio.gather(*pending_group_tasks, return_exceptions=True)
        await storage.close()
        await api.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
