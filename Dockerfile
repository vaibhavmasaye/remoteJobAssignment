# Build stage
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm ci

# Copy source files BEFORE generate
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Verify generation
RUN test -d src/generated/prisma && echo "✓ Prisma generated successfully" || (echo "✗ Prisma generation failed" && exit 1)

# Build TypeScript
RUN npm run build

# Runtime stage  
FROM node:23-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy runtime files
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled code AND node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

RUN chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
