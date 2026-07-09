FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && npm run start"]
