from aiogram.fsm.state import State, StatesGroup


class ArticleCreate(StatesGroup):
    title = State()
    summary = State()
    content = State()
    image = State()
    category = State()
    status = State()
    visibility = State()
    preview = State()
