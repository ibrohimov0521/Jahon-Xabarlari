export type NewsSource = { name: string; feedUrl: string };

// Every URL below was verified with a live rss-parser fetch before being added here.
// Reuters and AP are intentionally excluded: neither offers a public RSS feed anymore (both
// moved to paid-API-only access years ago), so there's no free/legal way to pull their content.
// Daryo.uz and Qalampir.uz don't have a discoverable feed (tried /rss, /feed, /rss.xml -- all
// 404 or malformed) -- add them here once you have the real feed URL for each.
export const NEWS_SOURCES: NewsSource[] = [
  // O'zbekiston
  { name: "Kun.uz", feedUrl: "https://kun.uz/news/rss" },
  { name: "Gazeta.uz", feedUrl: "https://www.gazeta.uz/en/rss/" },
  { name: "UzA", feedUrl: "https://uza.uz/uz/rss" },
  { name: "Podrobno.uz", feedUrl: "https://podrobno.uz/rss/" },
  { name: "Anhor.uz", feedUrl: "https://anhor.uz/rss" },
  { name: "Sputnik O'zbekiston", feedUrl: "https://uz.sputniknews.ru/export/rss2/archive/index.xml" },
  { name: "Xabar.uz", feedUrl: "https://xabar.uz/rss" },
  // Dunyo
  { name: "BBC World", feedUrl: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "NYT World", feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { name: "CNN Top Stories", feedUrl: "http://rss.cnn.com/rss/cnn_topstories.rss" },
  { name: "The Guardian World", feedUrl: "https://www.theguardian.com/world/rss" },
  { name: "DW", feedUrl: "https://rss.dw.com/rdf/rss-en-all" },
  // Sport
  { name: "BBC Sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml?edition=int" },
  { name: "ESPN", feedUrl: "https://www.espn.com/espn/rss/news" },
  { name: "Marca", feedUrl: "https://e00-marca.uecdn.es/rss/en/football.xml" },
  // Texnologiya
  { name: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/" },
  { name: "Ars Technica", feedUrl: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "Engadget", feedUrl: "https://www.engadget.com/rss.xml" },
  { name: "Wired", feedUrl: "https://www.wired.com/feed/rss" },
  { name: "VentureBeat", feedUrl: "https://venturebeat.com/feed/" },
  { name: "MIT Technology Review", feedUrl: "https://www.technologyreview.com/feed/" },
  { name: "BBC Technology", feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  // Iqtisodiyot
  { name: "BBC Business", feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "CNBC", feedUrl: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "Investing.com", feedUrl: "https://www.investing.com/rss/news.rss" },
  { name: "Yahoo Finance", feedUrl: "https://finance.yahoo.com/news/rssindex" }
];
