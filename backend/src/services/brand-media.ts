import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const watermarkPath = path.resolve(process.cwd(), "assets", "brand-watermark.png");
let logoPromise: Promise<Buffer> | null = null;
const INSTAGRAM_WIDTH = 1080;
const INSTAGRAM_HEIGHT = 1350;

type WatermarkOptions = {
  // Media uploaded before the BEST TEAM identity was introduced already contains the old mark
  // in its upper-right corner. Hide that small area before drawing the current transparent mark.
  replaceExistingWatermark?: boolean;
};

async function brandLogo() {
  logoPromise ??= readFile(watermarkPath);
  return logoPromise;
}

async function resizedBrandLogo(width: number) {
  // Trim transparent canvas space first. The supplied logo intentionally has generous empty
  // space around it, which otherwise made the visible mark look far too small on media.
  return sharp(await brandLogo())
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();
}

function legacyWatermarkMask(width: number, height: number) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${Math.max(8, Math.round(width * 0.12))}" fill="#020813" fill-opacity="0.84"/>
    </svg>
  `);
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function headlineLines(title: string, maximumLines = 5, maximumCharacters = 29) {
  const words = title.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maximumCharacters || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maximumLines) break;
  }
  if (line && lines.length < maximumLines) lines.push(line);

  const truncated = words.join(" ").length > lines.join(" ").length;
  if (truncated && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?…]+$/, "")}...`;
  return lines.map(escapeSvg);
}

function instagramOverlay(title: string) {
  const lines = headlineLines(title);
  const lineHeight = 76;
  const bottom = 112;
  const firstLineY = INSTAGRAM_HEIGHT - bottom - (Math.max(lines.length - 1, 0) * lineHeight);
  const text = lines.map((line, index) => `<text x="64" y="${firstLineY + (index * lineHeight)}" fill="#ffffff" font-family="Noto Sans, Arial, sans-serif" font-size="62" font-weight="700">${line}</text>`).join("");

  return Buffer.from(`
    <svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" viewBox="0 0 ${INSTAGRAM_WIDTH} ${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="30%" stop-color="#020813" stop-opacity="0" />
          <stop offset="100%" stop-color="#020813" stop-opacity="0.94" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#shade)" />
      <rect x="64" y="${firstLineY - 126}" width="196" height="42" rx="21" fill="#1463ff" />
      <text x="87" y="${firstLineY - 97}" fill="#ffffff" font-family="Noto Sans, Arial, sans-serif" font-size="22" font-weight="700">BEST TEAM NEWS</text>
      ${text}
    </svg>
  `);
}

// Current uploads remain unmodified in storage. The current logo is rendered when the image is
// delivered, so an identity update never leaves an outdated logo permanently baked into media.
export async function applyBrandWatermark(source: Buffer, options: WatermarkOptions = {}) {
  const image = sharp(source, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const metadata = await image.metadata();
  const width = Math.max(1, metadata.width ?? 1200);
  const height = Math.max(1, metadata.height ?? 800);
  const logoWidth = Math.min(220, Math.max(84, Math.round(width * 0.13)));
  const padding = Math.max(10, Math.round(Math.min(width, height) * 0.018));
  const logo = await resizedBrandLogo(logoWidth);
  const logoMetadata = await sharp(logo).metadata();
  const logoHeight = Math.max(1, logoMetadata.height ?? logoWidth);
  const logoLeft = Math.max(padding, width - logoWidth - padding);
  const composites: OverlayOptions[] = [];

  if (options.replaceExistingWatermark) {
    const maskSize = Math.max(logoWidth + (padding * 2), logoHeight + (padding * 2), Math.round(logoWidth * 1.18));
    composites.push({
      input: legacyWatermarkMask(maskSize, maskSize),
      top: Math.max(0, padding - Math.round(padding * 0.45)),
      left: Math.max(0, width - maskSize - Math.max(0, padding - Math.round(padding * 0.45))),
      blend: "over"
    });
  }
  composites.push({ input: logo, top: padding, left: logoLeft, blend: "over" });

  return image
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

// First carousel slide for Instagram: readable headline over the article image, followed by
// the branded original image as the second slide.
export async function createInstagramNewsCover(source: Buffer, title: string) {
  const logoWidth = 158;
  const logo = await resizedBrandLogo(logoWidth);
  return sharp(source, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: INSTAGRAM_WIDTH, height: INSTAGRAM_HEIGHT, fit: "cover", position: "attention" })
    .composite([
      { input: instagramOverlay(title), top: 0, left: 0 },
      { input: logo, top: 34, left: INSTAGRAM_WIDTH - 34 - logoWidth, blend: "over" }
    ])
    .jpeg({ quality: 91, mozjpeg: true })
    .toBuffer();
}
