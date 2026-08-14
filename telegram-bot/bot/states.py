from aiogram.fsm.state import State, StatesGroup


class ArticleCreate(StatesGroup):
    title = State()
    summary = State()
    content = State()
    image = State()
    instagram_format = State()
    category = State()
    status = State()
    visibility = State()
    preview = State()


class UserInquiry(StatesGroup):
    phone = State()
    message = State()


class AdminInquiryReply(StatesGroup):
    message = State()
