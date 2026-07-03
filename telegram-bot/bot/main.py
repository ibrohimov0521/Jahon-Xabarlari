from __future__ import annotations

import asyncio
import html

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, Message

from .api import BackendApi
from .config import load_settings
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
        await message.answer(
            f"<b>{html.escape(item['title'])}</b>\n"
            f"Status: {item['status']}\n"
            f"Kategoriya: {html.escape(item.get('category', {}).get('name', '-'))}\n"
            f"Ko'rishlar: {item['viewsCount']}",
            reply_markup=article_actions(item["id"]),
        )


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
    if not message.text or len(message.text.strip()) < 10:
        await message.answer("Qisqa tavsif kamida 10 ta belgidan iborat bo'lsin.")
        return
    await state.update_data(summary=message.text.strip())
    await state.set_state(ArticleCreate.content)
    await message.answer("3/9 Asosiy matnni yuboring:", reply_markup=cancel_keyboard())


@router.message(ArticleCreate.content)
async def set_content(message: Message, state: FSMContext):
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
