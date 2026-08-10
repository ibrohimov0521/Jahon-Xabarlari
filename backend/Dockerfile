FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat font-noto
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
RUN chown -R node:node /app
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && npm run start"]
