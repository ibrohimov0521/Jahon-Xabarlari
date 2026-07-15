import unittest

from bot.ai_classifier import fallback_classification


CATEGORIES = [
    {"id": "world", "name": "Dunyo", "slug": "dunyo"},
    {"id": "uz", "name": "O'zbekiston", "slug": "ozbekiston"},
    {"id": "sport", "name": "Sport", "slug": "sport"},
    {"id": "economy", "name": "Iqtisodiyot", "slug": "iqtisodiyot"},
]


class AiClassifierFallbackTests(unittest.TestCase):
    def test_sport_story_uses_sport_as_primary_category(self):
        result = fallback_classification("Jahon chempionati futbol finalida yangi gol urildi", CATEGORIES)
        self.assertEqual(result["categoryId"], "sport")
        self.assertTrue(result["showOnHome"])
        self.assertTrue(result["showInLatest"])

    def test_multi_topic_story_keeps_extra_categories_unique(self):
        result = fallback_classification("O'zbekiston bank bozori va jahon savdosi bo'yicha muhim xabar", CATEGORIES)
        self.assertEqual(result["categoryId"], "economy")
        self.assertIn("uz", result["extraCategoryIds"])
        self.assertEqual(len(result["extraCategoryIds"]), len(set(result["extraCategoryIds"])))


if __name__ == "__main__":
    unittest.main()
