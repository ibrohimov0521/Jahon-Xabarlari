from __future__ import annotations

import asyncio
import json
from typing import Any

import aiohttp


class BackendApi:
    def __init__(self, base_url: str, service_secret: str | None = None) -> None:
        self.base_url = base_url
        self.origin = base_url[:-4] if base_url.endswith("/api") else base_url
        self.service_secret = service_secret
        self._token_by_admin: dict[int, str] = {}
        self._user_by_admin: dict[int, dict] = {}
        self._session: aiohttp.ClientSession | None = None

    def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=35, connect=10, sock_read=30)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    def get_user(self, admin_id: int) -> dict | None:
        return self._user_by_admin.get(admin_id)

    @staticmethod
    async def _response_data(response: aiohttp.ClientResponse) -> Any:
        text = await response.text()
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"message": text[:300]}

    @staticmethod
    def _error_message(data: Any, fallback: str) -> str:
        if isinstance(data, dict) and isinstance(data.get("message"), str):
            return data["message"]
        return fallback

    async def login_telegram(self, telegram_id: int) -> dict[str, Any]:
        # The backend requires this shared secret (X-Bot-Secret) to prove the request really came
        # from the bot; without it telegram-login is rejected.
        headers = {"X-Bot-Secret": self.service_secret} if self.service_secret else {}
        session = self._get_session()
        try:
            async with session.post(
                f"{self.base_url}/auth/telegram-login",
                json={"telegramId": str(telegram_id)},
                headers=headers,
            ) as response:
                data = await self._response_data(response)
                if response.status >= 400:
                    raise PermissionError(self._error_message(data, "Ruxsat yo'q"))
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise RuntimeError("Backend bilan ulanish amalga oshmadi") from exc

        if not isinstance(data, dict) or not isinstance(data.get("accessToken"), str) or not isinstance(data.get("user"), dict):
            raise RuntimeError("Backend login javobi noto'g'ri")
        self._token_by_admin[telegram_id] = data["accessToken"]
        self._user_by_admin[telegram_id] = data["user"]
        return data

    async def request(self, admin_id: int, method: str, path: str, _retried: bool = False, **kwargs) -> Any:
        token = self._token_by_admin.get(admin_id)
        if not token:
            await self.login_telegram(admin_id)
            token = self._token_by_admin[admin_id]

        headers = dict(kwargs.pop("headers", {}))
        headers["Authorization"] = f"Bearer {token}"
        session = self._get_session()
        try:
            async with session.request(method, f"{self.base_url}{path}", headers=headers, **kwargs) as response:
                data = await self._response_data(response)
                if response.status == 401 and not _retried:
                    self._token_by_admin.pop(admin_id, None)
                    self._user_by_admin.pop(admin_id, None)
                    await self.login_telegram(admin_id)
                    return await self.request(admin_id, method, path, _retried=True, **kwargs)
                if response.status >= 400:
                    raise RuntimeError(self._error_message(data, f"Backend xatolik ({response.status})"))
                return data
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise RuntimeError("Backend bilan ulanish amalga oshmadi") from exc

    async def upload_media(self, admin_id: int, content: bytes, filename: str, content_type: str, _retried: bool = False) -> dict[str, Any]:
        token = self._token_by_admin.get(admin_id)
        if not token:
            await self.login_telegram(admin_id)
            token = self._token_by_admin[admin_id]

        form = aiohttp.FormData()
        form.add_field("file", content, filename=filename, content_type=content_type)
        session = self._get_session()
        try:
            async with session.post(
                f"{self.base_url}/admin/media/upload",
                data=form,
                headers={"Authorization": f"Bearer {token}"},
            ) as response:
                data = await self._response_data(response)
                if response.status == 401 and not _retried:
                    self._token_by_admin.pop(admin_id, None)
                    self._user_by_admin.pop(admin_id, None)
                    await self.login_telegram(admin_id)
                    return await self.upload_media(admin_id, content, filename, content_type, _retried=True)
                if response.status >= 400:
                    raise RuntimeError(self._error_message(data, f"Media yuklanmadi ({response.status})"))
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise RuntimeError("Media yuklash serveriga ulanib bo'lmadi") from exc

        if not isinstance(data, dict) or not isinstance(data.get("url"), str):
            raise RuntimeError("Media serveri noto'g'ri javob qaytardi")
        return data
