FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs ./server.mjs
COPY brand-watermark.png ./assets/brand-watermark.png

ENV PORT=8080
CMD ["node", "server.mjs"]
