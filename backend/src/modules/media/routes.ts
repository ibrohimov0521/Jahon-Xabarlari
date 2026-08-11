import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { parseByteRange } from "../../utils/http-range.js";
import { pagination } from "../../utils/query.js";
import { applyBrandWatermark } from "../../services/brand-media.js";

export const mediaRouter = Router();

// 25 MB. These files are stored inline in Postgres (MediaFile.data), so an unbounded cap is both
// a storage-exhaustion DoS vector and terrible for DB performance.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const BRAND_MEDIA_VERSION = "best-team-v3";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  // The client-declared mimetype is attacker-controlled, so this is only a cheap first gate --
  // the real check is sniffMedia() below, which inspects the actual bytes.
  fileFilter: (_req, file, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"].includes(file.mimetype))
});

// Verify the buffer really is one of the allowed media types by its magic bytes, and derive the
// mime/extension from the content -- never from the (spoofable) client filename or header.
function sniffMedia(buffer: Buffer): { mime: string; ext: string } | null {
  const ascii = (start: number, end: number) => buffer.slice(start, end).toString("latin1");
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "GIF8") return { mime: "image/gif", ext: "gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { mime: "video/webm", ext: "webm" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand.startsWith("qt")) return { mime: "video/quicktime", ext: "mov" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  return null;
}

mediaRouter.get("/file/:key", async (req, res) => {
  const item = await prisma.mediaFile.findUnique({ where: { key: req.params.key } });
  if (!item) return res.status(404).json({ message: "Fayl topilmadi" });
  if (!item.data) return res.status(404).json({ message: "Fayl saqlanmagan" });
  const data = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data);
  const isDynamicImage = item.mimeType.startsWith("image/") && item.mimeType !== "image/gif";

  if (isDynamicImage) {
    try {
      // Old database rows have no version in their URL and may have the retired logo embedded.
      // New uploads use replace=0 because the raw original is now saved in the database.
      const replaceExistingWatermark = req.query.replace !== "0";
      const branded = await applyBrandWatermark(data, { replaceExistingWatermark });
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("Vary", "Accept");
      return res.send(branded);
    } catch (error) {
      console.error("[media] dynamic watermark failed:", error);
      return res.status(422).json({ message: "Rasmga brend belgisi qo'shib bo'lmadi" });
    }
  }

  res.setHeader("Content-Type", item.mimeType);
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.setHeader("Accept-Ranges", "bytes");

  const rangeHeader = req.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, data.length);
    if (!range) {
      res.setHeader("Content-Range", `bytes */${data.length}`);
      return res.sendStatus(416);
    }
    const chunk = data.subarray(range.start, range.end + 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${data.length}`);
    res.setHeader("Content-Length", chunk.length.toString());
    return res.send(chunk);
  }

  res.setHeader("Content-Length", data.length.toString());
  res.send(data);
});

mediaRouter.use(requireAuth, permit("media.manage"));

mediaRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Fayl kerak" });
  let storedBuffer = req.file.buffer;
  let sniffed = sniffMedia(storedBuffer);
  if (!sniffed) return res.status(400).json({ message: "Fayl turi qo'llab-quvvatlanmaydi" });
  // Store the original bytes. The delivery endpoint applies the current logo dynamically, so a
  // rebrand can never leave a retired mark permanently burned into a newly uploaded image.
  // Key/extension/mimeType all come from the sniffed content, not req.file, so a spoofed
  // filename or Content-Type can't influence what we store or later serve.
  const key = `${crypto.randomUUID()}.${sniffed.ext}`;
  const url = `/api/admin/media/file/${key}?brand=${BRAND_MEDIA_VERSION}&replace=0`;
  const sha256 = crypto.createHash("sha256").update(storedBuffer).digest("hex");
  const item = await prisma.mediaFile.upsert({
    where: { sha256 },
    update: {},
    create: { key, url, sha256, mimeType: sniffed.mime, size: storedBuffer.length, data: storedBuffer },
    select: { id: true, url: true, key: true, mimeType: true, size: true, createdAt: true }
  });
  await audit(req, "MEDIA_UPLOAD", "MediaFile", item.id, { key: item.key, mimeType: item.mimeType, size: item.size });
  res.status(201).json(item);
});

mediaRouter.get("/", async (req, res) => {
  const { page, take, skip } = pagination(req.query, { limit: 30, max: 100 });
  const [items, total] = await Promise.all([
    prisma.mediaFile.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: { id: true, url: true, key: true, mimeType: true, size: true, createdAt: true }
    }),
    prisma.mediaFile.count()
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});

mediaRouter.delete("/:id", async (req, res) => {
  const item = await prisma.mediaFile.findUnique({
    where: { id: req.params.id },
    select: { id: true, key: true, url: true }
  });
  if (!item) return res.status(404).json({ message: "Fayl topilmadi" });
  // Admin clients resolve the relative media URL against the API origin before storing it on an
  // article, while the bot can store the relative form directly. Check both representations,
  // including every gallery entry, before allowing the binary to be removed.
  const urlSuffix = `%${item.url}`;
  const usedByArticles = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Article"
    WHERE "mainImage" = ${item.url}
       OR "mainImage" LIKE ${urlSuffix}
       OR EXISTS (
         SELECT 1
         FROM unnest("gallery") AS media(media_url)
         WHERE media_url = ${item.url} OR media_url LIKE ${urlSuffix}
       )
    LIMIT 1
  `);
  if (usedByArticles.length) {
    return res.status(409).json({ message: "Fayl maqolada ishlatilmoqda. Avval maqoladan olib tashlang" });
  }
  await prisma.mediaFile.delete({ where: { id: item.id } });
  await audit(req, "MEDIA_DELETE", "MediaFile", item.id, { key: item.key });
  res.json({ ok: true });
});
