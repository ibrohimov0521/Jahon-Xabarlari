import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? 8080);
const backendUrl = process.env.BACKEND_PUBLIC_URL;
const sharedSecret = process.env.MEDIA_RENDERER_SECRET;
const brandMark = process.env.BRAND_MARK_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "brand-watermark.png");
const maxConcurrentRenders = Math.max(1, Number(process.env.MAX_CONCURRENT_RENDERS ?? 1));
let activeRenders = 0;

if (!backendUrl || !sharedSecret) {
  throw new Error("BACKEND_PUBLIC_URL va MEDIA_RENDERER_SECRET kiritilishi kerak");
}

function signatureFor(articleId, mediaIndex) {
  return crypto.createHmac("sha256", sharedSecret).update(`${articleId}:${mediaIndex}`).digest("hex");
}

function sameSignature(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function respondJson(res, status, message) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ message }));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, activeRenders }));
  }
  const match = url.pathname.match(/^\/render\/([a-zA-Z0-9-]+)\/(\d+)$/);
  if (req.method !== "GET" || !match) return respondJson(res, 404, "Topilmadi");

  const [, articleId, rawIndex] = match;
  const mediaIndex = Number(rawIndex);
  if (!Number.isSafeInteger(mediaIndex) || mediaIndex < 0 || !sameSignature(url.searchParams.get("signature"), signatureFor(articleId, mediaIndex))) {
    return respondJson(res, 403, "Ruxsat yo'q");
  }
  if (activeRenders >= maxConcurrentRenders) {
    res.setHeader("Retry-After", "15");
    return respondJson(res, 429, "Video navbatda");
  }

  activeRenders += 1;
  const sourceUrl = new URL(`/api/social/instagram/articles/${encodeURIComponent(articleId)}/video/${mediaIndex}`, backendUrl).toString();
  const args = [
    "-hide_banner", "-loglevel", "error", "-i", sourceUrl, "-i", brandMark,
    "-filter_complex", "[1:v]scale=150:-1[logo];[0:v][logo]overlay=W-w-24:24:format=auto[video]",
    "-map", "[video]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"
  ];
  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let errorText = "";
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    activeRenders = Math.max(0, activeRenders - 1);
  };
  ffmpeg.stderr.on("data", (chunk) => { errorText = `${errorText}${chunk}`.slice(-2000); });
  ffmpeg.once("spawn", () => {
    if (res.destroyed) return ffmpeg.kill("SIGTERM");
    res.writeHead(200, { "content-type": "video/mp4", "cache-control": "public, max-age=3600" });
    ffmpeg.stdout.pipe(res);
  });
  ffmpeg.once("error", (error) => {
    finish();
    console.error("[media-renderer] ffmpeg ishga tushmadi:", error);
    if (!res.headersSent) return respondJson(res, 500, "Video render ishga tushmadi");
    res.destroy(error);
  });
  ffmpeg.once("close", (code) => {
    finish();
    if (code !== 0) {
      console.error("[media-renderer] ffmpeg failed:", errorText);
      if (!res.headersSent) respondJson(res, 502, "Video render yakunlanmadi");
      else if (!res.writableEnded) res.destroy();
    }
  });
  res.once("close", () => {
    if (!res.writableEnded && !ffmpeg.killed) ffmpeg.kill("SIGTERM");
  });
});

server.listen(port, "0.0.0.0", () => console.log(`[media-renderer] ${port}-portda ishga tushdi`));
