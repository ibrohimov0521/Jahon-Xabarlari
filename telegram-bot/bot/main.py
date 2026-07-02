from __future__ import annotations

import asyncio
import html

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.client.default import DefaultBotProperties

from .api import BackendApi
from .config import load_settings
from .keyboards import article_actions, confirm_keyboard, main_menu, status_keyboard, visibility_keyboard
from .states import ArticleCreate

settings = load_settings()
api = BackendApi(settings.api_base)
router = Router()


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


@router.message(CommandStart())
async def start(message: Message):
    if not await guard_message(message):
        return
    try:
        user = await api.login_telegram(message.from_user.id)
    except PermissionError as exc:
        await message.answer(str(exc))
        return
    await message.answer(f"Assalomu alaykum, {html.escape(user['user']['name'])}. Admin menyu:", reply_markup=main_menu())


@router.callback_query(F.data == "stats")
async def stats(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    data = await api.request(callback.from_user.id, "GET", "/admin/dashboard/stats")
    await callback.message.answer(
        "📊 <b>Statistika</b>\n"
        f"Jami yangiliklar: {data['totalArticles']}\n"
        f"Bugun qo'shilgan: {data['todayArticles']}\n"
        f"Jami ko'rishlar: {data['totalViews']}\n"
        f"Draft: {data['draftArticles']}\n"
        f"Review: {data['reviewArticles']}"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("articles"))
async def list_articles(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    status = callback.data.split(":", 1)[1] if ":" in callback.data else ""
    path = f"/admin/articles?status={status}" if status else "/admin/articles"
    data = await api.request(callback.from_user.id, "GET", path)
    if not data["items"]:
        await callback.message.answer("Maqolalar topilmadi.")
        await callback.answer()
        return
    for item in data["items"][:10]:
        await callback.message.answer(
            f"<b>{html.escape(item['title'])}</b>\nStatus: {item['status']}\nKo'rishlar: {item['viewsCount']}",
            reply_markup=article_actions(item["id"]),
        )
    await callback.answer()


@router.callback_query(F.data.startswith("status:"))
async def change_status(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    _, status, article_id = callback.data.split(":")
    data = await api.request(callback.from_user.id, "PATCH", f"/admin/articles/{article_id}/status", json={"status": status})
    await callback.message.answer(f"Status yangilandi: <b>{data['status']}</b>")
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
    await api.request(callback.from_user.id, "DELETE", f"/admin/articles/{article_id}")
    await callback.message.answer("Maqola trashga yuborildi.")
    await callback.answer()


@router.callback_query(F.data == "article_new")
async def article_new(callback: CallbackQuery, state: FSMContext):
    if not await guard_callback(callback):
        return
    await state.clear()
    await state.set_state(ArticleCreate.title)
    await callback.message.answer("1/9 Sarlavhani yuboring:")
    await callback.answer()


@router.message(ArticleCreate.title)
async def set_title(message: Message, state: FSMContext):
    if not await guard_message(message):
        return
    await state.update_data(title=message.text)
    await state.set_state(ArticleCreate.summary)
    await message.answer("2/9 Qisqa tavsifni yuboring:")


@router.message(ArticleCreate.summary)
async def set_summary(message: Message, state: FSMContext):
    await state.update_data(summary=message.text)
    await state.set_state(ArticleCreate.content)
    await message.answer("3/9 Asosiy matnni yuboring:")


@router.message(ArticleCreate.content)
async def set_content(message: Message, state: FSMContext):
    await state.update_data(content=message.text)
    await state.set_state(ArticleCreate.image)
    await message.answer("4/9 Rasm URL yuboring yoki '-' deb o'tkazib yuboring:")


@router.message(ArticleCreate.image)
async def set_image(message: Message, state: FSMContext):
    await state.update_data(mainImage="" if message.text == "-" else message.text)
    categories = await api.request(message.from_user.id, "GET", "/categories")
    buttons = [[InlineKeyboardButton(text=item["name"], callback_data=f"cat:{item['id']}")] for item in categories]
    await state.set_state(ArticleCreate.category)
    await message.answer("5/9 Kategoriyani tanlang:", reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))


@router.callback_query(ArticleCreate.category, F.data.startswith("cat:"))
async def set_category(callback: CallbackQuery, state: FSMContext):
    await state.update_data(categoryId=callback.data.split(":")[1])
    await state.set_state(ArticleCreate.status)
    await callback.message.answer("6/9 Statusni tanlang:", reply_markup=status_keyboard())
    await callback.answer()


@router.callback_query(ArticleCreate.status, F.data.startswith("new_status:"))
async def set_status(callback: CallbackQuery, state: FSMContext):
    await state.update_data(status=callback.data.split(":")[1], visibility=set())
    await state.set_state(ArticleCreate.visibility)
    await callback.message.answer("7/9 Qayerda ko'rinishini tanlang:", reply_markup=visibility_keyboard())
    await callback.answer()


@router.callback_query(ArticleCreate.visibility, F.data.startswith("vis:"))
async def set_visibility(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected = set(data.get("visibility", []))
    key = callback.data.split(":")[1]
    selected.remove(key) if key in selected else selected.add(key)
    await state.update_data(visibility=list(selected))
    await callback.message.edit_reply_markup(reply_markup=visibility_keyboard(selected))
    await callback.answer()


@router.callback_query(ArticleCreate.visibility, F.data == "vis_done")
async def preview(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.set_state(ArticleCreate.preview)
    await callback.message.answer(
        "8/9 <b>Preview</b>\n"
        f"Sarlavha: {html.escape(data['title'])}\n"
        f"Tavsif: {html.escape(data['summary'])}\n"
        f"Status: {data['status']}\n"
        f"Ko'rinish: {', '.join(data.get('visibility', [])) or 'default'}",
        reply_markup=confirm_keyboard("article_save"),
    )
    await callback.answer()


@router.callback_query(ArticleCreate.preview, F.data == "article_save_yes")
async def save_article(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    visibility = set(data.pop("visibility", []))
    payload = {
        **data,
        **{key: key in visibility for key in ["showOnHome", "showInSlider", "showInSidebar", "showInLatest", "showInPopular", "isBreaking", "isFeatured", "isEditorChoice"]},
    }
    saved = await api.request(callback.from_user.id, "POST", "/admin/articles", json=payload)
    await state.clear()
    await callback.message.answer(f"9/9 Maqola saqlandi: <b>{html.escape(saved['title'])}</b>", reply_markup=main_menu())
    await callback.answer()


@router.callback_query(F.data.in_({"comments", "ads", "settings", "toggle:breaking", "toggle:featured"}))
async def utility(callback: CallbackQuery):
    if not await guard_callback(callback):
        return
    if callback.data == "comments":
        data = await api.request(callback.from_user.id, "GET", "/admin/comments")
        await callback.message.answer(f"💬 Izohlar: {len(data['items'])} ta")
    elif callback.data == "ads":
        data = await api.request(callback.from_user.id, "GET", "/admin/advertisements")
        text = "\n".join([f"{item['title']} - {item['status']}" for item in data["items"]]) or "Reklama topilmadi"
        await callback.message.answer(f"📢 Reklamalar\n{text}")
    else:
        await callback.message.answer("Bu bo'lim API bilan ulanishga tayyor. Ro'yxatdan maqola tanlab status/flaglarni o'zgartiring.")
    await callback.answer()


async def main() -> None:
    bot = Bot(settings.token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher(storage=MemoryStorage())
    dispatcher.include_router(router)
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
