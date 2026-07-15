import unittest

from bot.forward_cleaner import clean_forward_text, prepare_forward_post, transliterate_cyrillic


class ForwardCleanerTests(unittest.TestCase):
    def test_removes_promotional_links_and_keeps_news(self):
        cleaned = clean_forward_text(
            "Toshkentda yangi metro bekati ochildi.\n"
            "Rasmiy kanal\n"
            "https://t.me/example"
        )
        self.assertEqual(cleaned, "Toshkentda yangi metro bekati ochildi.")

    def test_prepares_bounded_title_and_summary(self):
        post = prepare_forward_post("Muhim yangilik. " + "Tafsilot " * 40)
        self.assertLessEqual(len(post["title"]), 95)
        self.assertLessEqual(len(post["summary"]), 180)
        self.assertTrue(post["content"].startswith("Muhim yangilik"))

    def test_transliterates_uzbek_cyrillic_without_losing_meaning(self):
        self.assertEqual(transliterate_cyrillic("Ўзбекистонда янги лойиҳа"), "O'zbekistonda yangi loyiha")

    def test_removes_mentions_hashtags_flags_and_promotional_line(self):
        cleaned = clean_forward_text(
            "🇺🇿 Toshkentda yangi loyiha boshlandi #yangilik\n"
            "Kanalimizga qo'shiling @example"
        )
        self.assertEqual(cleaned, "Toshkentda yangi loyiha boshlandi")


if __name__ == "__main__":
    unittest.main()
