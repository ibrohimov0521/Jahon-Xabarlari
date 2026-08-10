import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const watermarkPath = path.resolve(process.cwd(), "assets", "brand-watermark.png");
let logoPromise: Promise<Buffer> | null = null;
const INSTAGRAM_WIDTH = 1080;
const INSTAGRAM_HEIGHT = 1350;

async function brandLogo() {
  logoPromise ??= readFile(watermarkPath);
  return logoPromise;
}

async function resizedBrandLogo(width: number) {
  // The watermark asset is a compact transparent crop of the supplied BEST TEAM NEWS logo.
  return sharp(await brandLogo())
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();
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
  const text = lines.map((line, index) => `<text x="64" y="${firstLineY + (index * lineHeight)}" fill="#ffffff" font-family="Arial, sans-serif" font-size="62" font-weight="700">${line}</text>`).join("");

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
      <text x="87" y="${firstLineY - 97}" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">BEST TEAM NEWS</text>
      ${text}
    </svg>
  `);
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
  const logo = await resizedBrandLogo(logoWidth);

  return image
    .composite([{ input: logo, top: padding, left: Math.max(padding, width - logoWidth - padding), blend: "over" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

// First carousel slide for Instagram: readable headline over the article image, followed by
// the branded original image as the second slide.
export async function createInstagramNewsCover(source: Buffer, title: string) {
  const logo = await resizedBrandLogo(196);
  return sharp(source, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: INSTAGRAM_WIDTH, height: INSTAGRAM_HEIGHT, fit: "cover", position: "attention" })
    .composite([
      { input: instagramOverlay(title), top: 0, left: 0 },
      { input: logo, top: 48, left: INSTAGRAM_WIDTH - 48 - 196, blend: "over" }
    ])
    .jpeg({ quality: 91, mozjpeg: true })
    .toBuffer();
}
