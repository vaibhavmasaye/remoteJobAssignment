# Build the TypeScript application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Keep the runtime simple so startup failures are visible in Render logs.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 10000

CMD ["node", "/app/dist/server.js"]
