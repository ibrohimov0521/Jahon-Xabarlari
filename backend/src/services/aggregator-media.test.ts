import assert from "node:assert/strict";
import test from "node:test";
import { extractFallbackFeedMedia, extractMetaMedia, extractPrimaryFeedMedia } from "./aggregator-media.js";

test("feed media selection prefers the largest original image", () => {
  const selected = extractPrimaryFeedMedia(
    {
      enclosure: { url: "https://cdn.example.com/thumb-200x200.jpg", type: "image/jpeg", width: 200, height: 200 },
      mediaContent: [
        { $: { url: "https://cdn.example.com/photo-320.jpg", type: "image/jpeg", width: 320, height: 180 } },
        { $: { url: "https://cdn.example.com/photo-original-1600.jpg", type: "image/jpeg", width: 1600, height: 900 } }
      ]
    },
    "https://example.com/news"
  );
  assert.equal(selected, "https://cdn.example.com/photo-original-1600.jpg");
});

test("article metadata supports reversed attributes, JSON-LD and relative URLs", () => {
  const html = `
    <meta content="/images/share-1200.jpg" property="og:image">
    <script type="application/ld+json">{"image":"/images/schema-original-1920.jpg"}</script>
    <img src="/images/thumb-200x200.jpg">
  `;
  assert.equal(extractMetaMedia(html, "https://example.com/story"), "https://example.com/images/share-1200.jpg");
});

test("fallback srcset chooses the widest available image", () => {
  const selected = extractFallbackFeedMedia(
    { content: '<img src="small.jpg" srcset="/photo-320.jpg 320w, /photo-1280.jpg 1280w">' },
    "https://example.com/story"
  );
  assert.equal(selected, "https://example.com/photo-1280.jpg");
});
