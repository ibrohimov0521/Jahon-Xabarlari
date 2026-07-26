import os
import unittest
from unittest.mock import patch

from bot.config import load_settings


BASE_ENV = {
    "BOT_TOKEN": "test-token",
    "BOT_ADMIN_IDS": "123,456",
    "BOT_SERVICE_SECRET": "test-service-secret-123456",
    "BOT_API_BASE": "https://api.example.com/api/",
    "ADMIN_PANEL_URL": "https://example.com/admin/",
    "REDIS_URL": "redis://localhost:6379",
}


class ConfigTests(unittest.TestCase):
    def test_normalizes_urls_and_bounds_concurrency(self):
        with patch.dict(os.environ, {**BASE_ENV, "FORWARD_CONCURRENCY": "99"}, clear=True):
            settings = load_settings()

        self.assertEqual(settings.api_base, "https://api.example.com/api")
        self.assertEqual(settings.admin_panel_url, "https://example.com/admin")
        self.assertEqual(settings.forward_concurrency, 5)
        self.assertEqual(settings.admin_ids, {123, 456})

    def test_rejects_missing_admin_ids(self):
        with patch.dict(os.environ, {**BASE_ENV, "BOT_ADMIN_IDS": ""}, clear=True):
            with self.assertRaisesRegex(ValueError, "BOT_ADMIN_IDS"):
                load_settings()

    def test_rejects_invalid_concurrency(self):
        with patch.dict(os.environ, {**BASE_ENV, "FORWARD_CONCURRENCY": "many"}, clear=True):
            with self.assertRaisesRegex(ValueError, "FORWARD_CONCURRENCY"):
                load_settings()

    def test_rejects_short_service_secret(self):
        with patch.dict(os.environ, {**BASE_ENV, "BOT_SERVICE_SECRET": "short"}, clear=True):
            with self.assertRaisesRegex(ValueError, "kamida 24"):
                load_settings()


if __name__ == "__main__":
    unittest.main()
