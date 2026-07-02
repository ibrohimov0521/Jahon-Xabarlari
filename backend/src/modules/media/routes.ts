import { Router } from "express";
import multer from "multer";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const mediaRouter = Router();
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.mimetype))
});

mediaRouter.use(requireAuth, permit("media.manage"));

mediaRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Fayl kerak" });
  const item = await prisma.mediaFile.create({
    data: { key: req.file.filename, url: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size }
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
