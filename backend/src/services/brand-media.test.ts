import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { applyBrandWatermark, createInstagramNewsCover } from "./brand-media.js";

for (const dimensions of [
  { width: 1600, height: 900, name: "landscape" },
  { width: 900, height: 1600, name: "portrait" }
]) {
  test(`Instagram cover preserves the ${dimensions.name} source dimensions`, async () => {
    const source = await sharp({
      create: {
        width: dimensions.width,
        height: dimensions.height,
        channels: 3,
        background: { r: 35, g: 90, b: 160 }
      }
    }).jpeg().toBuffer();

    const result = await createInstagramNewsCover(source, "Sinov yangiligi uchun yakunlangan sarlavha");
    const metadata = await sharp(result).metadata();

    assert.equal(metadata.width, dimensions.width);
    assert.equal(metadata.height, dimensions.height);
  });

  test(`watermarked ${dimensions.name} image preserves the source dimensions`, async () => {
    const source = await sharp({
      create: {
        width: dimensions.width,
        height: dimensions.height,
        channels: 3,
        background: { r: 35, g: 90, b: 160 }
      }
    }).jpeg().toBuffer();

    const result = await applyBrandWatermark(source);
    const metadata = await sharp(result).metadata();

    assert.equal(metadata.width, dimensions.width);
    assert.equal(metadata.height, dimensions.height);
  });
}
