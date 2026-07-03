from __future__ import annotations

import aiohttp


class BackendApi:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url
        self.origin = base_url[:-4] if base_url.endswith("/api") else base_url
        self._token_by_admin: dict[int, str] = {}
        self._user_by_admin: dict[int, dict] = {}

    def get_user(self, admin_id: int) -> dict | None:
        return self._user_by_admin.get(admin_id)

    async def login_telegram(self, telegram_id: int) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.base_url}/auth/telegram-login", json={"telegramId": str(telegram_id)}) as response:
                data = await response.json()
                if response.status >= 400:
                    raise PermissionError(data.get("message", "Ruxsat yo'q"))
                self._token_by_admin[telegram_id] = data["accessToken"]
                self._user_by_admin[telegram_id] = data["user"]
                return data

    async def request(self, admin_id: int, method: str, path: str, **kwargs) -> dict:
        token = self._token_by_admin.get(admin_id)
        if not token:
            await self.login_telegram(admin_id)
            token = self._token_by_admin[admin_id]

        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.request(method, f"{self.base_url}{path}", **kwargs) as response:
                data = await response.json()
                if response.status == 401:
                    await self.login_telegram(admin_id)
                    return await self.request(admin_id, method, path, **kwargs)
                if response.status >= 400:
                    raise RuntimeError(data.get("message", "Backend xatolik"))
                return data

    async def upload_media(self, admin_id: int, content: bytes, filename: str, content_type: str) -> dict:
        token = self._token_by_admin.get(admin_id)
        if not token:
            await self.login_telegram(admin_id)
            token = self._token_by_admin[admin_id]

        form = aiohttp.FormData()
        form.add_field("file", content, filename=filename, content_type=content_type)
        async with aiohttp.ClientSession(headers={"Authorization": f"Bearer {token}"}) as session:
            async with session.post(f"{self.base_url}/admin/media/upload", data=form) as response:
                data = await response.json()
                if response.status == 401:
                    await self.login_telegram(admin_id)
                    return await self.upload_media(admin_id, content, filename, content_type)
                if response.status >= 400:
                    raise RuntimeError(data.get("message", "Rasm yuklanmadi"))
                return data
