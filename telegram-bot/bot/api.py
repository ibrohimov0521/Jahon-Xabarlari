from __future__ import annotations

import aiohttp


class BackendApi:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url
        self._token_by_admin: dict[int, str] = {}

    async def login_telegram(self, telegram_id: int) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.base_url}/auth/telegram-login", json={"telegramId": str(telegram_id)}) as response:
                data = await response.json()
                if response.status >= 400:
                    raise PermissionError(data.get("message", "Ruxsat yo'q"))
                self._token_by_admin[telegram_id] = data["accessToken"]
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
