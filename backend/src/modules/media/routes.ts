import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const mediaRouter = Router();

// 25 MB. These files are stored inline in Postgres (MediaFile.data), so an unbounded cap is both
// a storage-exhaustion DoS vector and terrible for DB performance.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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
  res.setHeader("Content-Type", item.mimeType);
  res.setHeader("Content-Length", item.size.toString());
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.send(Buffer.from(item.data));
});

mediaRouter.use(requireAuth, permit("media.manage"));

mediaRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Fayl kerak" });
  const sniffed = sniffMedia(req.file.buffer);
  if (!sniffed) return res.status(400).json({ message: "Fayl turi qo'llab-quvvatlanmaydi" });
  // Key/extension/mimeType all come from the sniffed content, not req.file, so a spoofed
  // filename or Content-Type can't influence what we store or later serve.
  const key = `${crypto.randomUUID()}.${sniffed.ext}`;
  const url = `/api/admin/media/file/${key}`;
  const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const item = await prisma.mediaFile.upsert({
    where: { sha256 },
    update: {},
    create: { key, url, sha256, mimeType: sniffed.mime, size: req.file.size, data: req.file.buffer },
    select: { id: true, url: true, key: true, mimeType: true, size: true, createdAt: true }
  });
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
  await prisma.mediaFile.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
