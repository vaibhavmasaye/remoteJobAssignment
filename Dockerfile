# Build the TypeScript application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Keep the runtime simple so startup failures are visible in Render logs.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 10000

CMD ["node", "/app/dist/server.js"]
