import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const mediaRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.mimetype))
});

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
  const extension = req.file.originalname.includes(".") ? req.file.originalname.split(".").pop() : "bin";
  const key = `${crypto.randomUUID()}.${extension}`;
  const url = `/api/admin/media/file/${key}`;
  const item = await prisma.mediaFile.create({
    data: { key, url, mimeType: req.file.mimetype, size: req.file.size, data: req.file.buffer }
  });
  res.status(201).json(item);
});

mediaRouter.get("/", async (_req, res) => {
  res.json({ items: await prisma.mediaFile.findMany({ orderBy: { createdAt: "desc" } }) });
});

mediaRouter.delete("/:id", async (req, res) => {
  await prisma.mediaFile.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
