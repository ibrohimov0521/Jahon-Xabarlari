import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const watermarkPath = path.resolve(process.cwd(), "assets", "brand-mark.png");
let logoPromise: Promise<Buffer> | null = null;

async function brandLogo() {
  logoPromise ??= readFile(watermarkPath);
  return logoPromise;
}

// Images are branded once at upload time. The stored image can then be used safely on the
// site, Telegram and Instagram without an additional client-side modification.
export async function applyBrandWatermark(source: Buffer) {
  const image = sharp(source, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const metadata = await image.metadata();
  const width = Math.max(1, metadata.width ?? 1200);
  const height = Math.max(1, metadata.height ?? 800);
  const logoWidth = Math.min(260, Math.max(64, Math.round(width * 0.16)));
  const padding = Math.max(12, Math.round(Math.min(width, height) * 0.025));
  const logo = await sharp(await brandLogo())
    .trim({ background: "#00000000" })
    .resize({ width: logoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  return image
    .composite([{ input: logo, top: padding, left: Math.max(padding, width - logoWidth - padding), blend: "over" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
