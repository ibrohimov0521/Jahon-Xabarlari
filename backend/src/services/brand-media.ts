import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const watermarkPath = path.resolve(process.cwd(), "assets", "brand-watermark.png");
let logoPromise: Promise<Buffer> | null = null;

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

function instagramOverlay(title: string, width: number, height: number) {
  // Keep the source image dimensions untouched. All overlay measurements scale to the
  // original canvas instead of forcing every image into a cropped 4:5 frame.
  const scale = Math.max(0.5, Math.min(width / 1080, height / 1350));
  const fontSize = Math.max(26, Math.round(62 * scale));
  const lineHeight = Math.round(fontSize * 1.22);
  const margin = Math.max(24, Math.round(64 * scale));
  const bottom = margin + Math.round(24 * scale);
  const maximumCharacters = Math.max(22, Math.min(48, Math.floor((width - (margin * 2)) / (fontSize * 0.57))));
  const maximumLines = Math.max(2, Math.min(5, Math.floor((height * 0.42) / lineHeight)));
  const lines = headlineLines(title, maximumLines, maximumCharacters);
  const firstLineY = height - bottom - (Math.max(lines.length - 1, 0) * lineHeight);
  const badgeWidth = Math.round(196 * scale);
  const badgeHeight = Math.round(42 * scale);
  const badgeY = Math.max(margin, firstLineY - Math.round(126 * scale));
  const text = lines.map((line, index) => `<text x="${margin}" y="${firstLineY + (index * lineHeight)}" fill="#ffffff" font-family="Noto Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${line}</text>`).join("");

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="30%" stop-color="#020813" stop-opacity="0" />
          <stop offset="100%" stop-color="#020813" stop-opacity="0.94" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#shade)" />
      <rect x="${margin}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="#1463ff" />
      <text x="${margin + Math.round(23 * scale)}" y="${badgeY + Math.round(29 * scale)}" fill="#ffffff" font-family="Noto Sans, Arial, sans-serif" font-size="${Math.max(12, Math.round(22 * scale))}" font-weight="700">BEST TEAM NEWS</text>
      ${text}
    </svg>
  `);
}

async function blurredHeadlineBackdrop(source: Buffer, width: number, height: number) {
  const top = Math.max(0, Math.floor(height * 0.48));
  const panelHeight = height - top;
  const fadeHeight = Math.max(24, Math.round(panelHeight * 0.24));
  const alphaMask = Buffer.from(`
    <svg width="${width}" height="${panelHeight}" viewBox="0 0 ${width} ${panelHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="${Math.min(100, Math.round((fadeHeight / panelHeight) * 100))}%" stop-color="#ffffff" stop-opacity="0.82" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fade)" />
    </svg>
  `);

  const panel = await sharp(source)
    .extract({ left: 0, top, width, height: panelHeight })
    .blur(Math.max(8, Math.min(22, Math.round(width / 70))))
    .png()
    .toBuffer();

  return {
    top,
    input: await sharp(panel)
      .composite([{ input: alphaMask, blend: "dest-in" }])
      .png()
      .toBuffer()
  };
}

// Current uploads remain unmodified in storage. The current logo is rendered when the image is
// delivered, so an identity update never leaves an outdated logo permanently baked into media.
export async function applyBrandWatermark(source: Buffer, options: WatermarkOptions = {}) {
  const image = sharp(source, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const metadata = await image.metadata();
  const width = Math.max(1, metadata.width ?? 1200);
  const height = Math.max(1, metadata.height ?? 800);
  const logoWidth = Math.min(290, Math.max(112, Math.round(width * 0.16)));
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
export async function createInstagramNewsCover(source: Buffer, title: string, options: WatermarkOptions = {}) {
  const oriented = await sharp(source, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const width = oriented.info.width;
  const height = oriented.info.height;
  const logoWidth = Math.min(230, Math.max(112, Math.round(width * 0.16)));
  const logo = await resizedBrandLogo(logoWidth);
  const padding = Math.max(18, Math.round(Math.min(width, height) * 0.025));
  const blurredBackdrop = await blurredHeadlineBackdrop(oriented.data, width, height);
  const logoMetadata = await sharp(logo).metadata();
  const logoHeight = Math.max(1, logoMetadata.height ?? logoWidth);
  const replaceMask = options.replaceExistingWatermark
    ? [{
        input: legacyWatermarkMask(logoWidth + (padding * 2), logoHeight + (padding * 2)),
        top: Math.max(0, padding - Math.round(padding * 0.35)),
        left: Math.max(0, width - logoWidth - (padding * 2)),
        blend: "over" as const
      }]
    : [];
  return sharp(oriented.data, { failOn: "error", limitInputPixels: 50_000_000 })
    .composite([
      ...replaceMask,
      { input: blurredBackdrop.input, top: blurredBackdrop.top, left: 0, blend: "over" },
      { input: instagramOverlay(title, width, height), top: 0, left: 0 },
      { input: logo, top: padding, left: Math.max(padding, width - padding - logoWidth), blend: "over" }
    ])
    .jpeg({ quality: 91, mozjpeg: true })
    .toBuffer();
}
