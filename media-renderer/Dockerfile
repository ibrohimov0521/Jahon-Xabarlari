FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY media-renderer/server.mjs ./server.mjs
COPY backend/assets/brand-watermark.png ./assets/brand-watermark.png

ENV PORT=8080
CMD ["node", "server.mjs"]
